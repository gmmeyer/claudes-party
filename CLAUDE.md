# Claude's Party - Developer Context

This document provides context for Claude instances working on this codebase.

## Project Overview

Claude's Party is an Electron desktop application that monitors Claude Code sessions. It displays a persistent popover showing all running Claude Code instances, their status, and allows voice/SMS interaction.

## Architecture

```
src/
├── main/                    # Electron main process (Node.js)
│   ├── index.ts            # App entry, IPC handlers, lifecycle
│   ├── windows.ts          # BrowserWindow management (popover + settings)
│   ├── tray.ts             # System tray icon and menu
│   ├── hooks-listener.ts   # HTTP server receiving Claude Code hook events
│   ├── sessions.ts         # In-memory session state management
│   ├── claude-config.ts    # Read/write Claude Code settings.json
│   ├── elevenlabs.ts       # TTS via ElevenLabs API
│   ├── twilio.ts           # SMS send/receive via Twilio API (with auto-setup)
│   ├── telegram.ts         # Telegram bot integration
│   ├── discord.ts          # Discord webhook and bot integration
│   ├── notifications.ts    # Native OS notifications
│   ├── input-handler.ts    # Send input back to Claude sessions
│   └── store.ts            # Persistent settings via electron-store
├── preload/
│   └── index.ts            # Context bridge exposing IPC to renderer
├── renderer/
│   ├── popover/            # Status popover UI
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── renderer.ts
│   └── settings/           # Settings window UI
│       ├── index.html
│       ├── styles.css
│       └── renderer.ts
└── shared/
    └── types.ts            # Shared TypeScript interfaces
```

## Key Concepts

### Hook System
Claude Code sends events to this app via HTTP POST requests. The app runs an HTTP server (default port 31548) that receives:
- `PreToolUse` / `PostToolUse` - Tool execution tracking
- `Notification` - Claude needs user attention
- `Stop` - Session stopped (error or completion)
- `SessionStart` / `SessionEnd` - Session lifecycle

Hooks are configured in Claude Code's settings.json:
- macOS: `~/Library/Application Support/Claude/settings.json`
- Windows: `%APPDATA%\Claude\settings.json`
- Linux: `~/.config/claude/settings.json`

The app can automatically install/uninstall hooks via `claude-config.ts`.

### IPC Pattern
All renderer-to-main communication uses Electron IPC:
1. Channels defined in `src/shared/types.ts` as `IPC_CHANNELS`
2. Handlers registered in `src/main/index.ts`
3. Exposed to renderer via `src/preload/index.ts`
4. Type-safe access via `window.electronAPI`

### Session State
Sessions are stored in-memory in `sessions.ts`. Each session tracks:
- ID, working directory, status (active/waiting/stopped)
- Current tool being used
- Last notification message
- Timestamps for start and last activity

Sessions auto-remove 30 seconds after ending.

## Build System

```bash
npm run build      # TypeScript compile + copy static files
npm run dev        # Build and run with Electron
npm run dist:mac   # Package for macOS
npm run dist:win   # Package for Windows
```

Static files (HTML, CSS) are copied via `scripts/copy-static.js` since TypeScript only compiles .ts files.

## Important Files

- `package.json` - Dependencies include `@elevenlabs/elevenlabs-js@^2.31.0` and `twilio@^5.11.2`
- `tsconfig.json` - Targets ES2022, outputs to `dist/`
- `scripts/setup-hooks.sh` - Legacy shell script for manual hook setup (superseded by in-app installation)

## UI Details

### Popover Window
- Frameless, transparent, always-on-top by default
- Position configurable (corners of screen)
- Shows session cards with status indicators
- "Send Input" and "Voice" buttons appear when session is waiting

### Settings Window
- Standard framed window
- Sections: Voice (ElevenLabs), SMS (Twilio), Telegram, Discord, Notifications, Appearance, Claude Code Integration
- Each integration section has setup instructions, configuration fields, and test buttons
- Hook installation UI with status indicator and Install/Uninstall buttons

## External Services

### ElevenLabs
- Used for text-to-speech (reading notifications aloud)
- Voice input uses browser's Web Speech API (free), not ElevenLabs
- API calls made via native `https` module in `elevenlabs.ts`

### Twilio (SMS)
- SMS notifications when sessions complete or need input
- **Auto-setup**: Automatically uses existing phone numbers or purchases one
- Webhook server (port 31549) for receiving SMS responses
- For local development, use ngrok: `ngrok http 31549`

**Setup:**
1. Create account at twilio.com
2. Get Account SID and Auth Token from Console dashboard
3. Click "Auto Setup" - will find/purchase a phone number automatically
4. Enter your phone number to receive notifications
5. (Optional) Set webhook URL for SMS replies

**Reply format:**
- Just text your message (goes to waiting/most recent session)
- Or use `sessionId:message` for a specific session

### Telegram
- Telegram bot for notifications and bidirectional communication
- Uses long-polling (no webhook needed)
- Implemented in `telegram.ts`

**Setup:**
1. Message @BotFather on Telegram
2. Send `/newbot` and follow prompts
3. Copy the bot token to settings
4. Click "Setup", then send any message to your bot
5. Chat ID auto-detects

**Bot commands:**
- `/status` - Show active Claude sessions
- `/help` - Show available commands
- `/session <id> <message>` - Send to specific session
- Or just send a message to reply to the waiting session

### Discord
- Discord webhook for notifications
- Optional bot for receiving commands
- Implemented in `discord.ts`

**Setup (notifications only):**
1. In Discord: Channel Settings → Integrations → Webhooks
2. Create webhook, copy URL to settings

**Setup (with replies):**
1. Go to discord.com/developers/applications
2. Create New Application → Bot → Copy token
3. Enable "Message Content Intent" under Privileged Gateway Intents
4. Invite bot to server with Read/Send Messages permissions
5. Enable Developer Mode in Discord Settings → Advanced
6. Right-click channel → Copy ID

**Bot commands:**
- `!status` - Show active sessions
- `!help` - Show available commands
- `!claude <message>` - Send to waiting session
- `!session <id> <message>` - Send to specific session

## Common Tasks

### Adding a new IPC channel
1. Add channel name to `IPC_CHANNELS` in `src/shared/types.ts`
2. Add handler in `src/main/index.ts`
3. Expose in `src/preload/index.ts` (both implementation and type declaration)
4. Use via `window.electronAPI.newMethod()` in renderer

### Adding a new hook type
1. Add to `HookType` union in `src/shared/types.ts`
2. Handle in `processHookEvent()` in `src/main/sessions.ts`
3. Add to `generateHookCommands()` in `src/main/claude-config.ts`
4. Update UI if needed

### Modifying settings
1. Add property to `AppSettings` interface in `src/shared/types.ts`
2. Add default value in `DEFAULT_SETTINGS`
3. Add UI elements in settings HTML
4. Wire up in settings renderer.ts

## Gotchas

- Renderer TypeScript files compile to `.js` but HTML references `renderer.js` - make sure names match
- Web Speech API types conflict with DOM types; use `any` for SpeechRecognition
- electron-store uses encryption for sensitive data (API keys)
- Hook commands use `2>/dev/null || true` to fail silently and not break Claude Code

## Testing Hooks Manually

```bash
# Simulate a session start
curl -X POST http://127.0.0.1:31548/SessionStart \
  -H 'Content-Type: application/json' \
  -d '{"session_id": "test-123", "working_directory": "/tmp/test"}'

# Simulate a notification
curl -X POST http://127.0.0.1:31548/Notification \
  -H 'Content-Type: application/json' \
  -d '{"session_id": "test-123", "message": "Waiting for input..."}'
```

## Future Improvements to Consider

- Use ElevenLabs SDK properly instead of raw HTTP calls
- Add proper error boundaries in renderer
- Implement actual stdin piping to Claude Code sessions
- Add session history/logging
- Support multiple concurrent voice inputs
- Add test coverage
- Add WhatsApp integration via Twilio
- Add Slack integration
- Add Matrix/Element integration
