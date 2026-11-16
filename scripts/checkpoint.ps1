param(
    [Parameter(Mandatory = $true)][string]$Stage,
    [Parameter(Mandatory = $true)][string]$Summary,
    [Parameter(Mandatory = $true)][string]$Next,
    [string]$Checks = 'No new checks recorded.',
    [string]$Issues = 'None recorded.'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localDir = Join-Path $projectRoot '.local'
[IO.Directory]::CreateDirectory($localDir) | Out-Null
$lockPath = Join-Path $localDir 'checkpoint.lock'
$lockHandle = $null
try {
    $lockHandle = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None')
    Push-Location $projectRoot
    try {
        $status = @(& git status --short 2>$null)
        $commit = & git log -1 --format='%h %s' 2>$null
        if ($LASTEXITCODE -ne 0) { $commit = 'No commit yet.' }
    } finally { Pop-Location }
    $stamp = [DateTimeOffset]::UtcNow.ToString('o')
    $entry = @"

## Checkpoint $stamp

- Stage: $Stage
- Completed: $Summary
- Actual checks: $Checks
- Open issues: $Issues
- Next action: $Next
- Latest commit at checkpoint: $commit

Changed files at checkpoint:

``````text
$($status -join "`n")
``````
"@
    $statePath = Join-Path $projectRoot 'PROJECT_STATE.md'
    $current = if (Test-Path -LiteralPath $statePath) { [IO.File]::ReadAllText($statePath) } else { '# Project state' }
    $tempPath = Join-Path $projectRoot 'PROJECT_STATE.md.tmp'
    [IO.File]::WriteAllText($tempPath, $current + "`n" + $entry + "`n", [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $tempPath -Destination $statePath -Force
    $record = [ordered]@{ timestamp=$stamp; stage=$Stage; summary=$Summary; checks=$Checks; issues=$Issues; next=$Next; commit=$commit; files=$status }
    $json = $record | ConvertTo-Json -Depth 4
    [IO.File]::WriteAllText((Join-Path $localDir 'checkpoint.json'), $json, [Text.UTF8Encoding]::new($false))
    Write-Output "Checkpoint saved: $Stage"
} finally {
    if ($null -ne $lockHandle) { $lockHandle.Dispose() }
}
