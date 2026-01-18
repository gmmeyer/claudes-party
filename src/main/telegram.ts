import { getSettings, saveSettings } from './store';
import * as https from 'https';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS, TelegramMessage, SetupResult } from '../shared/types';
import { sendInputToSession } from './input-handler';
import { getSessions } from './sessions';
import { log } from './logger';
import {
  findSessionById,
  findTargetSession,
  formatSessionList,
  formatAmbiguousMatches,
} from './session-utils';

let mainWindow: BrowserWindow | null = null;
let pollingInterval: NodeJS.Timeout | null = null;
let lastUpdateId: number = 0;

export function setMainWindowForTelegram(window: BrowserWindow | null): void {
  mainWindow = window;
}

// Send message via Telegram Bot API
export async function sendTelegram(message: string, chatId?: string): Promise<boolean> {
  const settings = getSettings();

  if (!settings.telegramBotToken) {
    log.debug('Telegram bot token not configured');
    return false;
  }

  const targetChatId = chatId || settings.telegramChatId;
  if (!targetChatId) {
    log.debug('No Telegram chat ID configured');
    return false;
  }

  try {
    await sendTelegramMessage(settings.telegramBotToken, targetChatId, message);
    return true;
  } catch (error) {
    log.error('Error sending Telegram message', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
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
        if (res.statusCode === 200) {
          log.info('Telegram message sent successfully');
          resolve();
        } else {
          log.error('Telegram error response', { response: data });
          reject(new Error(`Telegram API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Get bot info to verify token
async function getBotInfo(botToken: string): Promise<{ id: number; username: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/getMe`,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data) as {
              ok: boolean;
              result: { id: number; username: string };
            };
            if (response.ok) {
              resolve(response.result);
            } else {
              reject(new Error('Invalid bot token'));
            }
          } catch (e) {
            reject(new Error('Failed to parse Telegram response'));
          }
        } else {
          reject(new Error(`Telegram API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Get updates from Telegram (long polling)
async function getUpdates(botToken: string, offset: number = 0): Promise<TelegramUpdate[]> {
  return new Promise((resolve, _reject) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/getUpdates?offset=${offset}&timeout=30`,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data) as {
              ok: boolean;
              result: TelegramUpdate[];
            };
            if (response.ok) {
              resolve(response.result);
            } else {
              resolve([]);
            }
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

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      username?: string;
      first_name: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
}

// Start polling for messages
export function startTelegramPolling(): void {
  const settings = getSettings();

  if (!settings.telegramBotToken || !settings.telegramReplyEnabled) {
    return;
  }

  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  log.info('Starting Telegram polling');

  const poll = async () => {
    try {
      const updates = await getUpdates(settings.telegramBotToken, lastUpdateId + 1);

      for (const update of updates) {
        lastUpdateId = update.update_id;

        if (update.message?.text) {
          const telegramMessage: TelegramMessage = {
            chatId: String(update.message.chat.id),
            messageId: update.message.message_id,
            text: update.message.text,
            timestamp: update.message.date * 1000,
            direction: 'inbound',
            username: update.message.from.username || update.message.from.first_name,
          };

          log.info('Received Telegram message', { chatId: telegramMessage.chatId, username: telegramMessage.username, text: telegramMessage.text.substring(0, 50) });

          // Notify renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_CHANNELS.TELEGRAM_RECEIVED, telegramMessage);
          }

          // Auto-save chat ID if not set
          if (!settings.telegramChatId) {
            saveSettings({ telegramChatId: telegramMessage.chatId });
          }

          // Process as Claude input
          if (settings.telegramReplyEnabled) {
            await handleIncomingTelegramMessage(telegramMessage);
          }
        }
      }
    } catch (error) {
      log.error('Telegram polling error', { error: error instanceof Error ? error.message : String(error) });
    }
  };

  // Initial poll
  void poll();

  // Continue polling every 5 seconds
  pollingInterval = setInterval(() => void poll(), 5000);
}

// Stop polling
export function stopTelegramPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    log.info('Stopped Telegram polling');
  }
}

// Handle incoming message as Claude input
async function handleIncomingTelegramMessage(message: TelegramMessage): Promise<void> {
  const text = message.text.trim();

  // Check for command format: /session <id> <input> or just the input
  let targetSessionId: string | undefined;
  let input: string = text;

  const sessionMatch = text.match(/^\/session\s+(\w+)\s+(.+)$/s);
  if (sessionMatch) {
    const idPrefix = sessionMatch[1];
    input = sessionMatch[2].trim();

    // Find session by prefix using shared utility
    const result = findSessionById(idPrefix);
    if (result.found && result.session) {
      targetSessionId = result.session.id;
    } else if (result.ambiguous && result.matches) {
      await sendTelegram(formatAmbiguousMatches(result.matches, idPrefix), message.chatId);
      return;
    } else {
      await sendTelegram(result.error || `No session found matching "${idPrefix}"`, message.chatId);
      return;
    }
  }

  // Handle special commands
  if (text === '/status') {
    const sessions = getSessions();
    const statusText = formatSessionList(sessions, 'markdown');
    if (sessions.length === 0) {
      await sendTelegram(statusText, message.chatId);
    } else {
      await sendTelegram(`*Active Sessions:*\n\n${statusText}`, message.chatId);
    }
    return;
  }

  if (text === '/help') {
    await sendTelegram(
      "*Claude's Party - Telegram Commands:*\n\n" +
        '`/status` - Show active sessions with IDs\n' +
        '`/session <id> <message>` - Send to specific session\n' +
        '\n_Or just send a message to reply to the waiting session._\n\n' +
        '*Examples:*\n' +
        '`/session abc123 yes, continue`\n' +
        '`/session abc123 please fix the bug`',
      message.chatId
    );
    return;
  }

  // Skip other commands
  if (text.startsWith('/')) {
    return;
  }

  // Find target session using shared utility
  if (!targetSessionId) {
    const target = findTargetSession();
    if (target) {
      targetSessionId = target.id;
    }
  }

  if (!targetSessionId) {
    await sendTelegram(
      'No active Claude session found.\n\nUse `/status` to see available sessions.',
      message.chatId
    );
    return;
  }

  // Send input to session
  const success = await sendInputToSession(targetSessionId, input);
  const shortId = targetSessionId.substring(0, 8);

  if (success) {
    log.info('Telegram input sent to session', { sessionId: targetSessionId, input: input.substring(0, 50) });
    const truncatedInput = input.length > 50 ? input.substring(0, 50) + '...' : input;
    await sendTelegram(`✅ Sent to *${shortId}*: "${truncatedInput}"`, message.chatId);
  } else {
    await sendTelegram(`❌ Failed to send to *${shortId}*.`, message.chatId);
  }
}

// Setup Telegram bot - verify token and optionally get chat ID
export async function setupTelegram(): Promise<SetupResult> {
  const settings = getSettings();

  if (!settings.telegramBotToken) {
    return { success: false, message: 'Telegram bot token not configured' };
  }

  try {
    const botInfo = await getBotInfo(settings.telegramBotToken);

    // Start polling to get chat ID
    startTelegramPolling();

    return {
      success: true,
      message: `Connected to Telegram bot @${botInfo.username}. Send a message to the bot to set up notifications.`,
      data: { botUsername: botInfo.username, botId: botInfo.id },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Test Telegram by sending a message
export async function testTelegram(): Promise<SetupResult> {
  const settings = getSettings();

  if (!settings.telegramBotToken) {
    return { success: false, message: 'Telegram bot token not configured' };
  }

  if (!settings.telegramChatId) {
    return {
      success: false,
      message: 'No chat ID configured. Send a message to your bot first.',
    };
  }

  try {
    await sendTelegram("Claude's Party is connected!");
    return { success: true, message: 'Test message sent successfully!' };
  } catch (error) {
    return {
      success: false,
      message: `Failed to send: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
