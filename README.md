# Claude's Party

A native desktop application for monitoring Claude Code sessions with voice input/output and SMS notifications.

## Features

- **Real-time Session Monitoring**: See all active Claude Code sessions in a sleek popover window
- **Hook Integration**: Receives events from Claude Code via webhooks (PreToolUse, PostToolUse, Notification, Stop, SessionStart, SessionEnd)
- **Voice Input/Output**: Use ElevenLabs for text-to-speech notifications and Web Speech API for voice input
- **SMS Notifications**: Get notified via SMS when sessions complete or need input (via Twilio)
- **Native Notifications**: Desktop notifications for session events
- **Cross-Platform**: Works on macOS and Windows

## Installation

### Prerequisites

- Node.js 18 or later
- npm or yarn

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/claudes-party.git
   cd claudes-party
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the application:
   ```bash
   npm run build
   ```

4. Run in development mode:
   ```bash
   npm run dev
   ```

### Building for Distribution

```bash
# macOS
npm run dist:mac

# Windows
npm run dist:win
```

## Configuration

### Claude Code Hooks

To connect Claude Code with Claude's Party, you need to configure hooks in your Claude Code settings.

**Option 1: Use the setup script**

```bash
# macOS/Linux
./scripts/setup-hooks.sh

# Windows (PowerShell)
.\scripts\setup-hooks.ps1
```

**Option 2: Manual configuration**

Add the following to your Claude Code settings file:

- macOS: `~/Library/Application Support/Claude/settings.json`
- Windows: `%APPDATA%\Claude\settings.json`
- Linux: `~/.config/claude/settings.json`

```json
{
  "hooks": {
    "PreToolUse": ["curl -s -X POST http://127.0.0.1:31548/PreToolUse -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "PostToolUse": ["curl -s -X POST http://127.0.0.1:31548/PostToolUse -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "Notification": ["curl -s -X POST http://127.0.0.1:31548/Notification -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "Stop": ["curl -s -X POST http://127.0.0.1:31548/Stop -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "SessionStart": ["curl -s -X POST http://127.0.0.1:31548/SessionStart -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "SessionEnd": ["curl -s -X POST http://127.0.0.1:31548/SessionEnd -H 'Content-Type: application/json' -d @- 2>/dev/null || true"]
  }
}
```

### ElevenLabs (Voice)

1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Get your API key from the dashboard
3. Enter the API key in Claude's Party settings
4. Optionally change the voice ID (default is Rachel)

### Twilio (SMS)

1. Sign up at [twilio.com](https://www.twilio.com)
2. Get your Account SID and Auth Token
3. Get a Twilio phone number
4. Enter these in Claude's Party settings
5. Enter your personal phone number to receive notifications

## Usage

### Popover Window

The popover shows all active Claude Code sessions with:
- Session ID
- Working directory
- Current status (active, waiting, stopped)
- Current tool being used
- Last notification message
- Session duration

### Sending Input

When a session is waiting for input, you can:
1. Click "Send Input" to type a response
2. Click "Voice" to speak your response (requires voice input enabled)

### System Tray

- Click the tray icon to toggle the popover
- Right-click for the context menu (Settings, Quit)

## Architecture

```
src/
├── main/                  # Main Electron process
│   ├── index.ts          # App entry point
│   ├── windows.ts        # Window management
│   ├── tray.ts           # System tray
│   ├── hooks-listener.ts # HTTP server for hooks
│   ├── sessions.ts       # Session state management
│   ├── elevenlabs.ts     # Voice integration
│   ├── twilio.ts         # SMS integration
│   ├── notifications.ts  # Native notifications
│   └── store.ts          # Settings persistence
├── preload/              # Preload scripts
│   └── index.ts          # IPC bridge
├── renderer/             # Renderer processes
│   ├── popover/          # Status popover UI
│   └── settings/         # Settings window UI
└── shared/               # Shared types
    └── types.ts          # TypeScript interfaces
```

## Development

```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# Run the app
npm start

# Build and run
npm run dev
```

## Troubleshooting

### Hooks not working

1. Make sure Claude's Party is running before starting Claude Code
2. Check if the hook server is running on the configured port (default: 31548)
3. Verify the hook configuration in Claude Code settings

### Voice not working

1. Check that your browser/Electron supports Web Speech API
2. Verify your ElevenLabs API key is correct
3. Make sure voice input/output is enabled in settings

### SMS not working

1. Verify your Twilio credentials
2. Make sure the phone numbers are in E.164 format (+1234567890)
3. Check Twilio console for error messages

## License

MIT
