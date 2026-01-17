import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { BrowserWindow } from 'electron';
import { HookEvent, HookType, IPC_CHANNELS } from '../shared/types';
import { processHookEvent, getSessions, ensureSession } from './sessions';
import { getSettings, saveSettings } from './store';
import { showNotification } from './notifications';
import { speakText } from './elevenlabs';
import { sendSms } from './twilio';
import { sendTelegram } from './telegram';
import { sendDiscord } from './discord';

let server: Server | null = null;
let popoverWindow: BrowserWindow | null = null;

export function setPopoverWindow(window: BrowserWindow | null): void {
  popoverWindow = window;
}

function notifyRenderer(): void {
  if (popoverWindow && !popoverWindow.isDestroyed()) {
    popoverWindow.webContents.send(IPC_CHANNELS.SESSIONS_UPDATED, getSessions());
  }
}

async function handleHookEvent(event: HookEvent): Promise<void> {
  // Ensure session exists
  ensureSession(event.sessionId);

  // Process the event
  const session = processHookEvent(event);

  // Notify renderer about the update
  notifyRenderer();

  const settings = getSettings();

  // Handle notifications based on event type
  switch (event.type) {
    case 'SessionEnd':
      if (settings.notifyOnSessionEnd) {
        const message = `Claude session ended in ${session?.workingDirectory || 'unknown directory'}`;

        if (settings.desktopNotificationsEnabled) {
          showNotification('Session Complete', message);
        }

        if (settings.voiceOutputEnabled && settings.elevenLabsApiKey) {
          await speakText('Claude session has ended');
        }

        if (settings.smsNotificationsEnabled && settings.twilioAccountSid) {
          await sendSms(message);
        }

        if (settings.telegramNotificationsEnabled && settings.telegramBotToken) {
          await sendTelegram(message);
        }

        if (settings.discordNotificationsEnabled && (settings.discordWebhookUrl || settings.discordBotToken)) {
          await sendDiscord(message);
        }
      }
      break;

    case 'Notification':
      if (settings.notifyOnWaitingForInput && event.data.message) {
        const message = event.data.message;

        if (settings.desktopNotificationsEnabled) {
          showNotification('Claude Notification', message);
        }

        if (settings.voiceOutputEnabled && settings.elevenLabsApiKey) {
          await speakText(message);
        }

        if (settings.smsNotificationsEnabled && settings.twilioAccountSid) {
          await sendSms(`Claude: ${message}`);
        }

        if (settings.telegramNotificationsEnabled && settings.telegramBotToken) {
          await sendTelegram(`*Claude:* ${message}`);
        }

        if (settings.discordNotificationsEnabled && (settings.discordWebhookUrl || settings.discordBotToken)) {
          await sendDiscord(`**Claude:** ${message}`);
        }
      }
      break;

    case 'Stop':
      if (settings.notifyOnError && event.data.reason) {
        const message = `Claude stopped: ${event.data.reason}`;

        if (settings.desktopNotificationsEnabled) {
          showNotification('Claude Stopped', message);
        }

        if (settings.smsNotificationsEnabled && settings.twilioAccountSid) {
          await sendSms(message);
        }

        if (settings.telegramNotificationsEnabled && settings.telegramBotToken) {
          await sendTelegram(message);
        }

        if (settings.discordNotificationsEnabled && (settings.discordWebhookUrl || settings.discordBotToken)) {
          await sendDiscord(message);
        }
      }
      break;
  }
}

function parseRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export function startHookServer(): void {
  const settings = getSettings();
  const port = settings.hookServerPort;

  if (server) {
    server.close();
  }

  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        res.writeHead(405);
        res.end('Method not allowed');
        return;
      }

      try {
        const body = await parseRequestBody(req);
        const data = JSON.parse(body) as Record<string, unknown>;

        // Extract hook type from URL path
        const url = new URL(req.url || '/', `http://localhost:${port}`);
        const pathParts = url.pathname.split('/').filter(Boolean);
        const hookType = pathParts[pathParts.length - 1] as HookType;

        // Validate hook type
        const validHooks: HookType[] = [
          'PreToolUse',
          'PostToolUse',
          'Notification',
          'Stop',
          'SessionStart',
          'SessionEnd',
        ];

        if (!validHooks.includes(hookType)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid hook type' }));
          return;
        }

        // Create hook event
        const sessionId = (data.session_id as string) || (data.sessionId as string) || 'unknown';
        const event: HookEvent = {
          type: hookType,
          sessionId,
          timestamp: Date.now(),
          data: data as HookEvent['data'],
        };

        // Process the event
        await handleHookEvent(event);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        console.error('Error processing hook:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    })();
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Hook server listening on http://127.0.0.1:${port}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error('Hook server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}`);
      server?.close();
      // Try next port
      const newSettings = { ...settings, hookServerPort: port + 1 };
      saveSettings(newSettings);
      startHookServer();
    }
  });
}

export function stopHookServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}

export function getServerPort(): number {
  return getSettings().hookServerPort;
}
