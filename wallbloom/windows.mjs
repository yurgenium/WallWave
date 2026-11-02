import {spawn} from 'node:child_process';
import {AppError} from './core.mjs';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import os from 'node:os';
import {createNativeHost, nativeFailure} from './native-host.mjs';

let diagnosticSink = null;
export function setDiagnosticSink(sink) { diagnosticSink = typeof sink === 'function' ? sink : null; }
function nativeDiagnostic(event, attributes) { try { diagnosticSink?.(event, attributes); } catch {} }

let lastCpu = os.cpus().map(c => ({...c.times}));
function cpuUsage() {
  const next = os.cpus().map(c => ({...c.times}));
  let total = 0, idle = 0;
  for (let i = 0; i < next.length; i++) {
    const prev = lastCpu[i] || next[i];
    for (const k of Object.keys(next[i])) total += next[i][k] - prev[k];
    idle += next[i].idle - prev.idle;
  }
  lastCpu = next;
  return total ? Math.max(0, Math.min(100, 100 * (1 - idle / total))) : 0;
}

// Windows PowerShell 5.1 writes redirected output in the OEM code page, which
// corrupts non-ASCII paths (for example a Cyrillic user name). Force UTF-8.
const utf8Output = '[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding $false;';

/** One-shot PowerShell call. Used for rare actions and as a fallback. */
export function powershell(script, env = {}, operation = 'unknown', timeout = 10000) {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', utf8Output + script], {windowsHide: true, env: {...process.env, ...env}});
    let output = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; p.kill(); }, timeout);
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', b => output += b);
    p.stderr.on('data', b => { if (stderr.length < 16384) stderr += b; });
    p.on('error', error => {
      clearTimeout(timer);
      const failure = nativeFailure('nativeStartFailed', operation, {nativeSystemCode: error.code});
      nativeDiagnostic('native.failed', {nativeOperation: operation, durationMs: Math.round(performance.now() - started), error: failure});
      reject(failure);
    });
    p.on('close', code => {
      clearTimeout(timer);
      if (code === 0 && !timedOut) {
        nativeDiagnostic('native.finished', {nativeOperation: operation, durationMs: Math.round(performance.now() - started), exitCode: code});
        resolve(output.replace(/^\uFEFF/, ''));
      } else {
        const error = nativeFailure(timedOut ? 'nativeTimeout' : 'nativeCommandFailed', operation, {exitCode: code, stderr});
        nativeDiagnostic('native.failed', {nativeOperation: operation, durationMs: Math.round(performance.now() - started), exitCode: code, error});
        reject(error);
      }
    });
  });
}

// C# helpers. They are compiled once by the long-lived host, or on every call
// by the one-shot fallback.
const helperTypes = `Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;public class WB { [StructLayout(LayoutKind.Sequential)]public struct L{public uint cbSize;public uint dwTime;}[DllImport("user32.dll")]public static extern bool GetLastInputInfo(ref L l);[DllImport("shell32.dll")]public static extern int SHQueryUserNotificationState(out int s);[DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern bool SystemParametersInfo(int a,int b,string c,int d);[DllImport("user32.dll",CharSet=CharSet.Unicode,EntryPoint="SystemParametersInfoW")]public static extern bool GetWallpaper(int a,int b,StringBuilder c,int d);public static uint Idle(){L l=new L();l.cbSize=(uint)Marshal.SizeOf(l);if(!GetLastInputInfo(ref l))throw new Exception();return unchecked((uint)Environment.TickCount-l.dwTime);}}
'@;
Add-Type -TypeDefinition $env:WALLWAVE_NATIVE_CODE;
Add-Type -AssemblyName System.Windows.Forms;
`;

// Request loop: one JSON request per line on stdin, one JSON reply per line on
// stdout. Replies are ASCII-only, so the console code page cannot damage them.
const hostLoop = `
function Send-Reply($value){
  $json=ConvertTo-Json -InputObject $value -Compress -Depth 3
  $json=[regex]::Replace($json,'[^\\x00-\\x7F]',{param($m) '\\u{0:x4}' -f [int][char]$m.Value})
  [Console]::Out.WriteLine($json);[Console]::Out.Flush()
}
Send-Reply @{ready=$true}
while($true){
  $line=[Console]::In.ReadLine();if($null -eq $line){break}
  $request=$null;$names=@()
  try{
    $request=ConvertFrom-Json -InputObject $line
    if($request.env){foreach($p in $request.env.PSObject.Properties){Set-Item -Path ('env:'+$p.Name) -Value ([string]$p.Value);$names+=$p.Name}}
    $result=@(& ([scriptblock]::Create($request.script)))
    Send-Reply @{id=$request.id;ok=$true;out=(($result|ForEach-Object {[string]$_}) -join [char]10)}
  }catch{
    Send-Reply @{id=$(if($request){$request.id}else{0});ok=$false;err=[string]$_}
  }finally{
    foreach($n in $names){Remove-Item -Path ('env:'+$n) -ErrorAction SilentlyContinue}
  }
}
`;

// Read through Electron's filesystem so packaged ASAR resources also work in PowerShell.
const monitorEnv = {WALLWAVE_NATIVE_CODE: readFileSync(fileURLToPath(new URL('./monitor-native.cs', import.meta.url)), 'utf8')};

const host = process.platform === 'win32' ? createNativeHost({
  command: 'powershell.exe',
  args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', 'Invoke-Expression $env:WALLWAVE_HOST_SCRIPT'],
  env: {...monitorEnv, WALLWAVE_HOST_SCRIPT: utf8Output + helperTypes + hostLoop},
}) : null;

/** Runs a script in the long-lived host; falls back to a one-shot call. */
export async function native(script, env, operation) {
  if (host?.available) {
    const started = performance.now();
    try {
      const output = await host.run(script, env, operation);
      nativeDiagnostic('native.finished', {nativeOperation: operation, durationMs: Math.round(performance.now() - started), exitCode: 0});
      return output;
    } catch (error) {
      if (!error.hostUnavailable) {
        nativeDiagnostic('native.failed', {nativeOperation: operation, durationMs: Math.round(performance.now() - started), exitCode: error.diagnostic?.exitCode, error});
        throw error;
      }
      nativeDiagnostic('native.failed', {nativeOperation: 'nativeHost', durationMs: Math.round(performance.now() - started), error});
    }
  }
  return powershell(helperTypes + script, {...monitorEnv, ...env}, operation);
}

export async function openWallhavenAccount() {
  if (process.platform !== 'win32') throw new AppError('windowsUnavailable');
  await powershell("Start-Process -FilePath 'https://wallhaven.cc/settings/account' -WindowStyle Normal");
}

// GPU counters come from WMI and are the slowest part of the check, so the host
// refreshes them at most every 10 seconds. The one-shot fallback measures every time.
const activityScript = `$state=0;[WB]::SHQueryUserNotificationState([ref]$state)|Out-Null;
if(-not $global:gpuAt -or ((Get-Date)-$global:gpuAt).TotalSeconds -ge 10){
  $gpu=$null;try{$engines=Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction Stop|Where-Object {$_.Name -notmatch 'engtype_VideoDecode|engtype_VideoEncode'};if($engines){$loads=$engines|Group-Object {$_.Name -replace '^pid_\\d+_',''}|ForEach-Object {($_.Group|Measure-Object UtilizationPercentage -Sum).Sum};$gpu=[Math]::Min(100,($loads|Measure-Object -Maximum).Maximum)}}catch{}
  $global:gpu=$gpu;$global:gpuAt=Get-Date
}
@{idle=[WB]::Idle();fullscreen=($state -eq 3);gpuLoad=$global:gpu;onBattery=([System.Windows.Forms.SystemInformation]::PowerStatus.PowerLineStatus -eq 'Offline');processes=@(Get-Process|Select-Object -ExpandProperty ProcessName);supported=$true}|ConvertTo-Json -Compress`;

export async function activity() {
  if (process.platform !== 'win32') return {idle: 0, fullscreen: true, processes: [], supported: false};
  const value = await native(activityScript, {}, 'activity');
  return {...JSON.parse(value), cpuLoad: cpuUsage()};
}

export async function listMonitors() {
  if (process.platform !== 'win32') return [];
  return JSON.parse(await native('ConvertTo-Json -InputObject @([WallpaperNative]::List()) -Compress', {}, 'listMonitors'));
}

export async function applyMonitor(file, id) {
  if (process.platform !== 'win32') throw new AppError('windowsUnavailable');
  await native('[WallpaperNative]::Set($env:WALLWAVE_MONITOR,$env:WALLWAVE_IMAGE)', {WALLWAVE_MONITOR: id, WALLWAVE_IMAGE: file}, 'applyMonitor');
}

export async function applyWallpaper(file) {
  if (process.platform !== 'win32') throw new AppError('windowsUnavailable');
  await native("if(-not [WB]::SystemParametersInfo(20,0,$env:WALLWAVE_IMAGE,3)){throw 'SystemParametersInfo failed'}", {WALLWAVE_IMAGE: file}, 'applyWallpaper');
}

export async function desktopInfo() {
  if (process.platform !== 'win32') return null;
  return JSON.parse(await native("$bounds=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;$text=New-Object System.Text.StringBuilder 32768;if(-not [WB]::GetWallpaper(115,32768,$text,0)){throw 'GetWallpaper failed'};@{width=$bounds.Width;height=$bounds.Height;wallpaper=$text.ToString()}|ConvertTo-Json -Compress", {}, 'desktopInfo'));
}
