#!/bin/bash
# Claude's Party - Hook Setup Script
# This script helps configure Claude Code hooks to connect with Claude's Party

set -e

PORT="${1:-31548}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Claude's Party - Hook Setup"
echo "==========================="
echo ""

# Detect Claude Code settings location
if [[ "$OSTYPE" == "darwin"* ]]; then
    CLAUDE_SETTINGS_DIR="$HOME/Library/Application Support/Claude"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    CLAUDE_SETTINGS_DIR="$APPDATA/Claude"
else
    CLAUDE_SETTINGS_DIR="$HOME/.config/claude"
fi

SETTINGS_FILE="$CLAUDE_SETTINGS_DIR/settings.json"

echo "Looking for Claude Code settings at: $SETTINGS_FILE"
echo ""

# Generate hook configuration
HOOK_CONFIG=$(cat <<EOF
{
  "hooks": {
    "PreToolUse": ["curl -s -X POST http://127.0.0.1:${PORT}/PreToolUse -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "PostToolUse": ["curl -s -X POST http://127.0.0.1:${PORT}/PostToolUse -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "Notification": ["curl -s -X POST http://127.0.0.1:${PORT}/Notification -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "Stop": ["curl -s -X POST http://127.0.0.1:${PORT}/Stop -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "SessionStart": ["curl -s -X POST http://127.0.0.1:${PORT}/SessionStart -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "SessionEnd": ["curl -s -X POST http://127.0.0.1:${PORT}/SessionEnd -H 'Content-Type: application/json' -d @- 2>/dev/null || true"]
  }
}
EOF
)

echo "Hook configuration to add to your Claude Code settings:"
echo ""
echo "$HOOK_CONFIG"
echo ""
echo "==========================="
echo ""

# Check if settings file exists
if [ -f "$SETTINGS_FILE" ]; then
    echo "Found existing settings file."
    echo ""
    echo "To add hooks, you can:"
    echo "1. Open $SETTINGS_FILE in your editor"
    echo "2. Add the 'hooks' section from above to your settings"
    echo ""
    read -p "Would you like to open the settings file? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open "$SETTINGS_FILE"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "$SETTINGS_FILE"
        else
            echo "Please open: $SETTINGS_FILE"
        fi
    fi
else
    echo "Settings file not found."
    echo "Create $SETTINGS_FILE with the hook configuration above."
    echo ""
    read -p "Would you like to create the settings file with hooks? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mkdir -p "$CLAUDE_SETTINGS_DIR"
        echo "$HOOK_CONFIG" > "$SETTINGS_FILE"
        echo "Created $SETTINGS_FILE"
    fi
fi

echo ""
echo "Setup complete!"
echo "Make sure Claude's Party is running before starting Claude Code."
