param(
  [ValidateSet('Start','Status','Stop')][string]$Action = 'Status',
  [string]$ThreadId = $env:CODEX_THREAD_ID
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localDir = Join-Path $projectRoot '.local'
[IO.Directory]::CreateDirectory($localDir) | Out-Null
$statePath = Join-Path $localDir 'auto-resume-state.json'
if ($Action -eq 'Stop') {
  [IO.File]::WriteAllText((Join-Path $localDir 'auto-resume.stop'), 'User requested stop')
  Write-Output 'Stop requested. The watcher exits within 5 seconds of an idle wait (an in-flight request can take up to 20 seconds).'
  return
}
if ($Action -eq 'Status') {
  if (-not (Test-Path -LiteralPath $statePath)) { Write-Output 'Auto resume has not been started.'; return }
  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  $watcher = Get-CimInstance Win32_Process -Filter "ProcessId = $($state.pid)" -ErrorAction SilentlyContinue
  $state | Add-Member -NotePropertyName processVerified -NotePropertyValue ([bool]($watcher -and $watcher.CommandLine -and $watcher.CommandLine.Contains((Join-Path $PSScriptRoot 'auto-resume.mjs')))) -Force
  $state | ConvertTo-Json -Depth 6
  return
}
if (-not $env:CODEX_APP_TOOLS_PIPE_PATH -or -not $ThreadId -or $ThreadId -ne $env:CODEX_THREAD_ID) { throw 'Start inside the target Codex desktop chat; its native app connection is required.' }
if (Test-Path -LiteralPath (Join-Path $localDir 'project-complete.json')) { throw 'The project is marked complete. Review remaining work before starting recovery again.' }
$nodePath = (Get-Command node -ErrorAction Stop).Source
$pluginRoot = Join-Path $env:USERPROFILE '.codex\plugins\cache\openai-bundled\codex-app-tools'
$plugin = Get-ChildItem -LiteralPath $pluginRoot -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
$serverPath = Join-Path $plugin.FullName 'server.mjs'
if (-not (Test-Path -LiteralPath $serverPath)) { throw 'Installed Codex app-tools MCP server not found.' }
if (Test-Path -LiteralPath $statePath) {
  $old = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  $existing = Get-CimInstance Win32_Process -Filter "ProcessId = $($old.pid)" -ErrorAction SilentlyContinue
  if ($existing -and $existing.CommandLine -and $existing.CommandLine.Contains((Join-Path $PSScriptRoot 'auto-resume.mjs'))) { throw 'The recovery watcher is already running. Use -Action Status.' }
}
$config = @{ threadId=$ThreadId; projectRoot=$projectRoot; serverPath=$serverPath; maxResumes=6; graceMs=90000; pollMs=60000; lifetimeMs=172800000 }
[IO.File]::WriteAllText((Join-Path $localDir 'auto-resume-config.json'), ($config | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
$scriptPath = Join-Path $PSScriptRoot 'auto-resume.mjs'
$process = Start-Process -FilePath $nodePath -ArgumentList @(('"' + $scriptPath + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localDir 'auto-resume.stdout.log') -RedirectStandardError (Join-Path $localDir 'auto-resume.stderr.log') -PassThru
Write-Output "Recovery watcher started, PID $($process.Id). Verify with scripts/auto-resume.ps1 -Action Status. Keep Codex open and the PC awake."
