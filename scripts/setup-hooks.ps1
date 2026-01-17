# Claude's Party - Hook Setup Script for Windows
# This script helps configure Claude Code hooks to connect with Claude's Party

param(
    [int]$Port = 31548
)

Write-Host "Claude's Party - Hook Setup" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""

# Claude Code settings location
$ClaudeSettingsDir = "$env:APPDATA\Claude"
$SettingsFile = "$ClaudeSettingsDir\settings.json"

Write-Host "Looking for Claude Code settings at: $SettingsFile"
Write-Host ""

# Generate hook configuration
$HookConfig = @"
{
  "hooks": {
    "PreToolUse": ["curl -s -X POST http://127.0.0.1:$Port/PreToolUse -H 'Content-Type: application/json' -d @- 2>nul || exit 0"],
    "PostToolUse": ["curl -s -X POST http://127.0.0.1:$Port/PostToolUse -H 'Content-Type: application/json' -d @- 2>nul || exit 0"],
    "Notification": ["curl -s -X POST http://127.0.0.1:$Port/Notification -H 'Content-Type: application/json' -d @- 2>nul || exit 0"],
    "Stop": ["curl -s -X POST http://127.0.0.1:$Port/Stop -H 'Content-Type: application/json' -d @- 2>nul || exit 0"],
    "SessionStart": ["curl -s -X POST http://127.0.0.1:$Port/SessionStart -H 'Content-Type: application/json' -d @- 2>nul || exit 0"],
    "SessionEnd": ["curl -s -X POST http://127.0.0.1:$Port/SessionEnd -H 'Content-Type: application/json' -d @- 2>nul || exit 0"]
  }
}
"@

Write-Host "Hook configuration to add to your Claude Code settings:" -ForegroundColor Yellow
Write-Host ""
Write-Host $HookConfig
Write-Host ""
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""

# Check if settings file exists
if (Test-Path $SettingsFile) {
    Write-Host "Found existing settings file." -ForegroundColor Green
    Write-Host ""
    Write-Host "To add hooks, you can:"
    Write-Host "1. Open $SettingsFile in your editor"
    Write-Host "2. Add the 'hooks' section from above to your settings"
    Write-Host ""

    $response = Read-Host "Would you like to open the settings file? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Start-Process notepad $SettingsFile
    }
} else {
    Write-Host "Settings file not found." -ForegroundColor Yellow
    Write-Host "Create $SettingsFile with the hook configuration above."
    Write-Host ""

    $response = Read-Host "Would you like to create the settings file with hooks? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        New-Item -ItemType Directory -Force -Path $ClaudeSettingsDir | Out-Null
        $HookConfig | Out-File -FilePath $SettingsFile -Encoding utf8
        Write-Host "Created $SettingsFile" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "Make sure Claude's Party is running before starting Claude Code."
