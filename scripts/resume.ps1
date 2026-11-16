param(
    [string]$SessionId,
    [switch]$Start,
    [switch]$NewSession
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localDir = Join-Path $projectRoot '.local'
[IO.Directory]::CreateDirectory($localDir) | Out-Null
$lockHandle = $null
try {
    # A file handle held until Codex exits prevents concurrent launches through this wrapper.
    $lockHandle = [IO.File]::Open((Join-Path $localDir 'resume.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    foreach ($name in @('PROJECT_STATE.md','TASKS.md','DECISIONS.md')) {
        $file = Join-Path $projectRoot $name
        if (-not (Test-Path -LiteralPath $file)) { throw "Missing recovery file: $name" }
        Write-Output ([IO.File]::ReadAllText($file))
    }
    Push-Location $projectRoot
    try {
        & git status --short
        & git log -5 --oneline
        if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect repository history.' }
    } finally { Pop-Location }
    if (-not $Start) {
        Write-Output 'Inspection complete. When this project has no active agent, launch with -Start -SessionId <id>, or explicitly use -Start -NewSession.'
        return
    }
    if ($SessionId -and $NewSession) { throw 'Choose SessionId OR NewSession.' }
    if (-not $SessionId -and -not $NewSession) { throw 'An explicit SessionId or NewSession is required; the most recent unrelated chat is never selected automatically.' }
    $codexCommand = Get-Command codex -ErrorAction Stop
    $existing = Get-CimInstance Win32_Process -Filter "Name = 'codex.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($projectRoot) -and $_.CommandLine -match '\b(resume|exec)\b' }
    if ($existing) { throw 'Another Codex CLI process references this project. Finish that session first.' }
    $prompt = 'Continue this project from PROJECT_STATE.md, TASKS.md and DECISIONS.md. Check git status and recent commits. Use local MGI-Mind project memory if available. Preserve existing work. Continue the first unfinished task. Do not deploy the website or bypass usage limits.'
    if ($SessionId) {
        & $codexCommand.Source resume --help *> $null
        if ($LASTEXITCODE -ne 0) { throw 'Installed CLI does not support resume. Use -Start -NewSession to reconstruct context from checkpoints.' }
        & $codexCommand.Source resume $SessionId -C $projectRoot $prompt
    } else {
        & $codexCommand.Source -C $projectRoot $prompt
    }
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Codex exited without completing the session. State remains saved; no automatic retry was started.' }
} finally {
    if ($null -ne $lockHandle) { $lockHandle.Dispose() }
}
