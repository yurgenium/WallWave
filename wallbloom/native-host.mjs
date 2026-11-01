// One long-lived helper process for frequent Windows calls.
//
// Starting powershell.exe and compiling the C# helpers used to happen on every
// call (every 2.5 s for activity checks). The host below starts once, compiles
// the helpers once and then runs short scripts sent over stdin, one at a time.
// If the host cannot start, run() rejects with error.hostUnavailable and the
// caller falls back to the one-shot runner.
import {spawn} from 'node:child_process';
import {AppError} from './core.mjs';

// Escape everything outside ASCII so the pipe encoding (OEM code page in
// Windows PowerShell 5.1) can never corrupt paths with Cyrillic letters.
export function asciiJson(value) {
  return JSON.stringify(value).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function nativeFailure(reason, operation, {exitCode, nativeSystemCode, stderr = ''} = {}) {
  const error = new AppError('windowsUnavailable');
  error.diagnostic = {
    reason,
    stage: 'native',
    nativeOperation: operation,
    exitCode,
    nativeSystemCode,
    hresult: String(stderr).match(/\b0x[0-9a-f]{8}\b/i)?.[0],
  };
  return error;
}

/**
 * @param {object} options
 * @param {string} options.command        executable, e.g. powershell.exe
 * @param {string[]} options.args         arguments that start the request loop
 * @param {object} [options.env]          extra environment for the host
 * @param {number} [options.timeout]      per-request limit in ms
 * @param {number} [options.startTimeout] limit for the "ready" message
 * @param {number} [options.retryAfter]   pause before trying a broken host again
 */
export function createNativeHost({command, args, env = {}, timeout = 10000, startTimeout = 20000, retryAfter = 5 * 60000, spawnImpl = spawn} = {}) {
  let host = null; // {process, ready: Promise, isReady, buffer}
  let current = null; // request being executed
  let sequence = 0, unavailableUntil = 0;
  const queue = [];

  const unavailable = error => Object.assign(error, {hostUnavailable: true});

  function finish(entry, settle) {
    if (current !== entry) return;
    current = null;
    clearTimeout(entry.timer);
    settle(entry);
    setImmediate(pump);
  }

  function kill(target) {
    if (!target) return;
    if (host === target) host = null;
    target.process.removeAllListeners();
    target.process.stdout?.removeAllListeners();
    try { target.process.kill(); } catch {}
  }

  function onDeath(target, error) {
    if (host !== target) return;
    kill(target);
    if (!target.isReady) {
      unavailableUntil = Date.now() + retryAfter;
      target.rejectReady(unavailable(error));
    } else if (current) {
      finish(current, entry => entry.reject(error));
    }
  }

  function onLine(target, line) {
    if (!line.startsWith('{')) return;
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message.ready) { target.isReady = true; target.resolveReady(); return; }
    const entry = current;
    if (!entry || message.id !== entry.id) return;
    finish(entry, e => message.ok
      ? e.resolve(String(message.out ?? ''))
      : e.reject(nativeFailure('nativeCommandFailed', e.operation, {exitCode: 1, stderr: message.err})));
  }

  function start() {
    if (host) return host;
    const target = {isReady: false, buffer: ''};
    target.ready = new Promise((resolve, reject) => { target.resolveReady = resolve; target.rejectReady = reject; });
    target.ready.catch(() => {});
    try {
      target.process = spawnImpl(command, args, {windowsHide: true, env: {...process.env, ...env}, stdio: ['pipe', 'pipe', 'ignore']});
    } catch (error) {
      unavailableUntil = Date.now() + retryAfter;
      target.rejectReady(unavailable(nativeFailure('nativeStartFailed', 'nativeHost', {nativeSystemCode: error.code})));
      return target;
    }
    host = target;
    const p = target.process;
    // The host must never keep the background service alive on its own.
    p.unref?.();
    p.stdin?.unref?.();
    p.stdout?.unref?.();
    p.stdin?.on?.('error', () => {});
    p.stdout.setEncoding?.('utf8');
    p.stdout.on('data', chunk => {
      target.buffer += chunk;
      let index;
      while ((index = target.buffer.indexOf('\n')) >= 0) {
        const line = target.buffer.slice(0, index).trim();
        target.buffer = target.buffer.slice(index + 1);
        onLine(target, line);
      }
      if (target.buffer.length > 8 * 1024 * 1024) onDeath(target, nativeFailure('nativeCommandFailed', current?.operation || 'nativeHost'));
    });
    p.on('error', error => onDeath(target, nativeFailure('nativeStartFailed', current?.operation || 'nativeHost', {nativeSystemCode: error.code})));
    p.on('exit', code => onDeath(target, nativeFailure('nativeCommandFailed', current?.operation || 'nativeHost', {exitCode: code ?? undefined})));
    const startTimer = setTimeout(() => onDeath(target, nativeFailure('nativeTimeout', 'nativeHost')), startTimeout);
    target.ready.then(() => clearTimeout(startTimer), () => clearTimeout(startTimer));
    return target;
  }

  async function pump() {
    if (current || !queue.length) return;
    const entry = queue.shift();
    current = entry;
    if (Date.now() < unavailableUntil) {
      finish(entry, e => e.reject(unavailable(nativeFailure('nativeStartFailed', e.operation))));
      return;
    }
    const target = start();
    try {
      await target.ready;
    } catch (error) {
      finish(entry, e => e.reject(error));
      return;
    }
    if (current !== entry || host !== target) {
      if (current === entry) finish(entry, e => e.reject(nativeFailure('nativeCommandFailed', e.operation)));
      return;
    }
    entry.timer = setTimeout(() => {
      // A stuck call: replace the host so later calls are not blocked.
      kill(target);
      finish(entry, e => e.reject(nativeFailure('nativeTimeout', e.operation)));
    }, timeout);
    try {
      target.process.stdin.write(asciiJson({id: entry.id, script: entry.script, env: entry.env}) + '\n');
    } catch {
      kill(target);
      finish(entry, e => e.reject(nativeFailure('nativeCommandFailed', e.operation)));
    }
  }

  return {
    get available() { return Date.now() >= unavailableUntil; },
    run(script, env = {}, operation = 'unknown') {
      return new Promise((resolve, reject) => {
        queue.push({id: ++sequence, script, env, operation, resolve, reject});
        pump();
      });
    },
    close() {
      kill(host);
      if (current) finish(current, e => e.reject(nativeFailure('nativeCommandFailed', e.operation)));
      for (const entry of queue.splice(0)) entry.reject(nativeFailure('nativeCommandFailed', entry.operation));
    },
  };
}
