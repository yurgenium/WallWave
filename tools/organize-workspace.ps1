$ErrorActionPreference='Stop'
$workspace=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$project=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$archive=Join-Path $workspace 'archive'
$legacy=Join-Path $archive 'legacy'
[void](New-Item -ItemType Directory -Path $legacy -Force)
$manifest=@()
function Preserve-Entry([string]$source,[string]$destination){
 $resolvedSource=[IO.Path]::GetFullPath($source)
 $resolvedDestination=[IO.Path]::GetFullPath($destination)
 if(-not $resolvedSource.StartsWith($workspace+'\',[StringComparison]::OrdinalIgnoreCase) -or -not $resolvedDestination.StartsWith($workspace+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Move escapes workspace'}
 if(Test-Path -LiteralPath $resolvedDestination){throw "Destination already exists: $resolvedDestination"}
 Move-Item -LiteralPath $resolvedSource -Destination $resolvedDestination
 $script:manifest += [pscustomobject]@{from=$resolvedSource;to=$resolvedDestination}
 $script:manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $archive 'layout-rollback.json') -Encoding utf8
}
foreach($entry in Get-ChildItem -LiteralPath $workspace -Force){
 if($entry.Name -in 'wallbloom','archive','.pnpm-store','.git'){continue}
 if($entry.Name -eq 'WallWave.exe'){continue}
 Preserve-Entry $entry.FullName (Join-Path $legacy $entry.Name)
}
$logs=Join-Path $project 'work\logs'
[void](New-Item -ItemType Directory -Path $logs -Force)
foreach($file in Get-ChildItem -LiteralPath $project -Filter '*.log' -File){Preserve-Entry $file.FullName (Join-Path $logs $file.Name)}
$oldReleases=Join-Path $archive 'releases'
[void](New-Item -ItemType Directory -Path $oldReleases -Force)
foreach($file in Get-ChildItem -LiteralPath (Join-Path $project 'dist') -File){if($file.Name -like 'Wallbloom*.exe' -or $file.Name -like '*before-launch-fix.exe'){Preserve-Entry $file.FullName (Join-Path $oldReleases $file.Name)}}
foreach($name in 'LICENSE','CHANGELOG.md'){Copy-Item -LiteralPath (Join-Path $project $name) -Destination (Join-Path $workspace $name)}
Write-Output 'Workspace organized; older files preserved in archive; active source stays in wallbloom.'
