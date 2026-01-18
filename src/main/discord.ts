import { getSettings } from './store';
import * as https from 'https';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS, DiscordMessage, SetupResult } from '../shared/types';
import { sendInputToSession } from './input-handler';
import { getSessions, getSession } from './sessions';
import { log } from './logger';

let mainWindow: BrowserWindow | null = null;
let gatewayConnection: WebSocketLike | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// Simple WebSocket-like interface for the Discord gateway
interface WebSocketLike {
  send: (data: string) => void;
  close: () => void;
}

export function setMainWindowForDiscord(window: BrowserWindow | null): void {
  mainWindow = window;
}

// Send message via Discord Webhook (simple notification)
export async function sendDiscordWebhook(message: string): Promise<boolean> {
  const settings = getSettings();

  if (!settings.discordWebhookUrl) {
    log.debug('Discord webhook URL not configured');
    return false;
  }

  try {
    await sendWebhookMessage(settings.discordWebhookUrl, message);
    return true;
  } catch (error) {
    log.error('Error sending Discord webhook', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

function sendWebhookMessage(webhookUrl: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const postData = JSON.stringify({ content });

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 204) {
          log.info('Discord webhook sent successfully');
          resolve();
        } else {
          log.error('Discord webhook error', { response: data });
          reject(new Error(`Discord API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Send message via Discord Bot API (to specific channel)
export async function sendDiscordBot(message: string, channelId?: string): Promise<boolean> {
  const settings = getSettings();

  if (!settings.discordBotToken) {
    // Fall back to webhook
    return sendDiscordWebhook(message);
  }

  const targetChannelId = channelId || settings.discordChannelId;
  if (!targetChannelId) {
    log.debug('No Discord channel ID configured');
    return false;
  }

  try {
    await sendBotMessage(settings.discordBotToken, targetChannelId, message);
    return true;
  } catch (error) {
    log.error('Error sending Discord bot message', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

function sendBotMessage(botToken: string, channelId: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ content });

    const options = {
      hostname: 'discord.com',
      port: 443,
      path: `/api/v10/channels/${channelId}/messages`,
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          log.info('Discord bot message sent successfully');
          resolve();
        } else {
          log.error('Discord bot error', { response: data });
          reject(new Error(`Discord API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Main send function - tries bot first, falls back to webhook
export async function sendDiscord(message: string, channelId?: string): Promise<boolean> {
  const settings = getSettings();

  if (settings.discordBotToken && (channelId || settings.discordChannelId)) {
    return sendDiscordBot(message, channelId);
  }

  return sendDiscordWebhook(message);
}

// Verify bot token
async function getBotInfo(botToken: string): Promise<{ id: string; username: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'discord.com',
      port: 443,
      path: '/api/v10/users/@me',
      method: 'GET',
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data) as { id: string; username: string };
            resolve(response);
          } catch (e) {
            reject(new Error('Failed to parse Discord response'));
          }
        } else {
          reject(new Error(`Discord API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Connect to Discord Gateway for receiving messages
// Note: This uses a simplified HTTP-based polling approach for desktop apps
// For a full implementation, you would use a WebSocket library
export function startDiscordBot(): void {
  const settings = getSettings();

  if (!settings.discordBotToken || !settings.discordReplyEnabled) {
    return;
  }

  log.info('Discord bot configured (webhook mode for notifications)');

  // For receiving messages, we'll use HTTP polling of recent messages
  // This is simpler than maintaining a WebSocket connection
  // and works well for desktop applications
  startDiscordPolling();
}

let discordPollingInterval: NodeJS.Timeout | null = null;
let lastMessageId: string | null = null;

function startDiscordPolling(): void {
  const settings = getSettings();

  if (!settings.discordBotToken || !settings.discordChannelId || !settings.discordReplyEnabled) {
    return;
  }

  if (discordPollingInterval) {
    clearInterval(discordPollingInterval);
  }

  log.info('Starting Discord message polling');

  const poll = async () => {
    try {
      const messages = await getChannelMessages(
        settings.discordBotToken,
        settings.discordChannelId,
        lastMessageId || undefined
      );

      // Process new messages (oldest first)
      const newMessages = messages.reverse();

      for (const msg of newMessages) {
        // Skip bot's own messages
        if (msg.author.bot) continue;

        // Update last message ID
        if (!lastMessageId || msg.id > lastMessageId) {
          lastMessageId = msg.id;
        }

        const discordMessage: DiscordMessage = {
          channelId: settings.discordChannelId,
          messageId: msg.id,
          content: msg.content,
          timestamp: new Date(msg.timestamp).getTime(),
          direction: 'inbound',
          username: msg.author.username,
        };

        log.info('Received Discord message', { channelId: discordMessage.channelId, username: discordMessage.username, content: discordMessage.content.substring(0, 50) });

        // Notify renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.DISCORD_RECEIVED, discordMessage);
        }

        // Process as Claude input
        await handleIncomingDiscordMessage(discordMessage);
      }
    } catch (error) {
      log.error('Discord polling error', { error: error instanceof Error ? error.message : String(error) });
    }
  };

  // Initial poll to get last message ID
  void (async () => {
    try {
      const messages = await getChannelMessages(
        settings.discordBotToken,
        settings.discordChannelId
      );
      if (messages.length > 0) {
        lastMessageId = messages[0].id;
      }
    } catch (e) {
      log.error('Failed to initialize Discord polling', { error: e instanceof Error ? e.message : String(e) });
    }
  })();

  // Poll every 5 seconds
  discordPollingInterval = setInterval(() => void poll(), 5000);
}

interface DiscordApiMessage {
  id: string;
  content: string;
  timestamp: string;
  author: {
    id: string;
    username: string;
    bot?: boolean;
  };
}

async function getChannelMessages(
  botToken: string,
  channelId: string,
  afterId?: string
): Promise<DiscordApiMessage[]> {
  return new Promise((resolve, _reject) => {
    let path = `/api/v10/channels/${channelId}/messages?limit=10`;
    if (afterId) {
      path += `&after=${afterId}`;
    }

    const options = {
      hostname: 'discord.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const messages = JSON.parse(data) as DiscordApiMessage[];
            resolve(messages);
          } catch (e) {
            resolve([]);
          }
        } else {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
    req.end();
  });
}

export function stopDiscordBot(): void {
  if (discordPollingInterval) {
    clearInterval(discordPollingInterval);
    discordPollingInterval = null;
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (gatewayConnection) {
    gatewayConnection.close();
    gatewayConnection = null;
  }

  log.info('Discord bot stopped');
}

// Find session by full or partial ID
function findSessionById(
  idPrefix: string
): { id: string; session: ReturnType<typeof getSession> } | null {
  // Try exact match first
  const exactSession = getSession(idPrefix);
  if (exactSession) {
    return { id: idPrefix, session: exactSession };
  }

  // Try prefix match
  const sessions = getSessions();
  const matches = sessions.filter((s) => s.id.startsWith(idPrefix));

  if (matches.length === 1) {
    return { id: matches[0].id, session: matches[0] };
  }

  if (matches.length > 1) {
    return null; // Ambiguous
  }

  return null;
}

// Handle incoming Discord message as Claude input
async function handleIncomingDiscordMessage(message: DiscordMessage): Promise<void> {
  const content = message.content.trim();

  // Check for command format: !session <id> <input> or just the input
  let targetSessionId: string | undefined;
  let input: string = content;

  const sessionMatch = content.match(/^!session\s+(\w+)\s+(.+)$/s);
  if (sessionMatch) {
    const idPrefix = sessionMatch[1];
    input = sessionMatch[2].trim();

    // Find session by prefix
    const found = findSessionById(idPrefix);
    if (found) {
      targetSessionId = found.id;
    } else {
      const sessions = getSessions();
      const matches = sessions.filter((s) => s.id.startsWith(idPrefix));
      if (matches.length > 1) {
        await sendDiscord(
          `Multiple sessions match "${idPrefix}":\n` +
            matches
              .map((s) => `• \`${s.id.substring(0, 8)}\` - ${s.workingDirectory?.split('/').pop()}`)
              .join('\n')
        );
        return;
      }
      await sendDiscord(`No session found matching "${idPrefix}"`);
      return;
    }
  }

  // Handle special commands
  if (content === '!status') {
    const sessions = getSessions();
    if (sessions.length === 0) {
      await sendDiscord('No active Claude sessions.');
    } else {
      const statusText = sessions
        .map((s) => {
          const shortId = s.id.substring(0, 8);
          const dirName = s.workingDirectory?.split('/').pop() || 'unknown';
          const statusIcon =
            s.status === 'waiting'
              ? ':hourglass:'
              : s.status === 'active'
                ? ':arrows_counterclockwise:'
                : ':stop_button:';
          return (
            `${statusIcon} **${shortId}** (${s.status})\n` +
            `    :file_folder: \`${dirName}\`\n` +
            (s.currentTool ? `    :wrench: ${s.currentTool}\n` : '') +
            `    _\`!session ${shortId} <msg>\`_`
          );
        })
        .join('\n\n');
      await sendDiscord(`**Active Sessions:**\n\n${statusText}`);
    }
    return;
  }

  if (content === '!help') {
    await sendDiscord(
      "**Claude's Party - Discord Commands:**\n\n" +
        '`!status` - Show active sessions with IDs\n' +
        '`!session <id> <message>` - Send to specific session\n' +
        '`!claude <message>` - Send to waiting/recent session\n' +
        '\n_Or just send a message to reply to the waiting session._\n\n' +
        '**Examples:**\n' +
        '`!session abc123 yes, continue`\n' +
        '`!claude please fix the bug`'
    );
    return;
  }

  // Skip other commands that start with !
  if (
    content.startsWith('!') &&
    !content.startsWith('!claude ') &&
    !content.startsWith('!session ')
  ) {
    return;
  }

  // Extract actual input
  if (content.startsWith('!claude ')) {
    input = content.substring(8).trim();
  }

  // Find target session
  if (!targetSessionId) {
    const sessions = getSessions();
    const waitingSession = sessions.find((s) => s.status === 'waiting');
    if (waitingSession) {
      targetSessionId = waitingSession.id;
    } else {
      const activeSession = sessions
        .filter((s) => s.status === 'active')
        .sort((a, b) => b.lastActivity - a.lastActivity)[0];
      if (activeSession) {
        targetSessionId = activeSession.id;
      }
    }
  }

  if (!targetSessionId) {
    await sendDiscord(
      'No active Claude session found.\n\nUse `!status` to see available sessions.'
    );
    return;
  }

  const session = getSession(targetSessionId);
  if (!session) {
    await sendDiscord(`Session "${targetSessionId}" not found.`);
    return;
  }

  // Send input to session
  const success = await sendInputToSession(targetSessionId, input);
  const shortId = targetSessionId.substring(0, 8);

  if (success) {
    log.info('Discord input sent to session', { sessionId: targetSessionId, input: input.substring(0, 50) });
    const truncatedInput = input.length > 50 ? input.substring(0, 50) + '...' : input;
    await sendDiscord(`:white_check_mark: Sent to **${shortId}**: "${truncatedInput}"`);
  } else {
    await sendDiscord(`:x: Failed to send to **${shortId}**.`);
  }
}

// Setup Discord - verify token and/or webhook
export async function setupDiscord(): Promise<SetupResult> {
  const settings = getSettings();

  if (!settings.discordBotToken && !settings.discordWebhookUrl) {
    return {
      success: false,
      message: 'Neither Discord bot token nor webhook URL configured',
    };
  }

  try {
    let botInfo: { id: string; username: string } | null = null;

    if (settings.discordBotToken) {
      botInfo = await getBotInfo(settings.discordBotToken);

      if (settings.discordReplyEnabled && settings.discordChannelId) {
        startDiscordPolling();
      }
    }

    const message = botInfo
      ? `Connected to Discord bot ${botInfo.username}${settings.discordWebhookUrl ? ' (webhook also configured)' : ''}`
      : 'Discord webhook configured (no bot for replies)';

    return {
      success: true,
      message,
      data: botInfo ? { botUsername: botInfo.username, botId: botInfo.id } : undefined,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Test Discord by sending a message
export async function testDiscord(): Promise<SetupResult> {
  try {
    const success = await sendDiscord("Claude's Party is connected!");
    if (success) {
      return { success: true, message: 'Test message sent successfully!' };
    } else {
      return { success: false, message: 'Failed to send test message. Check your configuration.' };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to send: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
