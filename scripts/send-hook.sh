#!/bin/bash
# Claude's Party - Hook Script
# This script sends hook events to the Claude's Party app
# Usage: ./send-hook.sh <hook_type>
# Hook types: PreToolUse, PostToolUse, Notification, Stop, SessionStart, SessionEnd

HOOK_TYPE="${1:-Notification}"
PORT="${CLAUDES_PARTY_PORT:-31548}"
HOST="${CLAUDES_PARTY_HOST:-127.0.0.1}"

# Read stdin (the hook payload from Claude Code)
PAYLOAD=$(cat)

# Send to Claude's Party
curl -s -X POST "http://${HOST}:${PORT}/${HOOK_TYPE}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}" \
  --connect-timeout 2 \
  --max-time 5 \
  2>/dev/null || true

# Exit successfully even if curl fails (don't break Claude Code)
exit 0
