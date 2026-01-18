import { app, ipcMain, BrowserWindow } from 'electron';
import {
  createPopoverWindow,
  createSettingsWindow,
  getPopoverWindow,
  togglePopover,
  updatePopoverSettings,
} from './windows';
import { createTray, destroyTray, updateTrayIcon } from './tray';
import { startHookServer, stopHookServer, setPopoverWindow, getServerPort } from './hooks-listener';
import { getSettings, saveSettings } from './store';
import { getSessions } from './sessions';
import { initNotifications, showNotification } from './notifications';
import { speakText, startVoiceInput, stopVoiceInput, setPopoverWindowForVoice } from './elevenlabs';
import {
  sendSms,
  startSmsWebhookServer,
  stopSmsWebhookServer,
  setMainWindowForSms,
  setupTwilio,
  getTwilioPhoneNumbers,
  buyPhoneNumber,
  searchAvailableNumbers,
} from './twilio';
import {
  sendTelegram,
  setupTelegram,
  testTelegram,
  startTelegramPolling,
  stopTelegramPolling,
  setMainWindowForTelegram,
} from './telegram';
import {
  sendDiscord,
  setupDiscord,
  testDiscord,
  startDiscordBot,
  stopDiscordBot,
  setMainWindowForDiscord,
} from './discord';
import { sendInputToSession, cleanupOldInputs } from './input-handler';
import { installHooks, uninstallHooks, getHookStatus } from './claude-config';
import { installCli, uninstallCli, getCliStatus } from './cli-installer';
import { IPC_CHANNELS, AppSettings } from '../shared/types';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    const popover = getPopoverWindow();
    if (popover) {
      if (popover.isMinimized()) popover.restore();
      popover.focus();
    }
  });
}

// Handle app ready
void app.whenReady().then(() => {
  // Initialize notifications
  initNotifications();

  // Create system tray
  createTray();

  // Create popover window
  const popover = createPopoverWindow();

  // Set up window references for modules
  setPopoverWindow(popover);
  setPopoverWindowForVoice(popover);
  setMainWindowForSms(popover);
  setMainWindowForTelegram(popover);
  setMainWindowForDiscord(popover);

  // Start hook server
  startHookServer();

  // Start SMS webhook server (for receiving SMS)
  const settings = getSettings();
  if (settings.twilioAccountSid) {
    startSmsWebhookServer();
  }

  // Start Telegram polling if configured
  if (settings.telegramBotToken && settings.telegramReplyEnabled) {
    startTelegramPolling();
  }

  // Start Discord bot if configured
  if (settings.discordBotToken && settings.discordReplyEnabled) {
    startDiscordBot();
  }

  // Periodic cleanup of old input files
  setInterval(cleanupOldInputs, 60000);

  // Update tray based on sessions
  setInterval(() => {
    const sessions = getSessions();
    updateTrayIcon(sessions.length > 0);
  }, 5000);

  console.log(`Claude's Party started. Hook server on port ${getServerPort()}`);
});

// IPC Handlers

// Settings
ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
  return getSettings();
});

ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_, settings: Partial<AppSettings>) => {
  const oldSettings = getSettings();
  const newSettings = saveSettings(settings);

  // Update popover if position/opacity changed
  updatePopoverSettings();

  // Handle Twilio changes
  if (settings.twilioAccountSid !== undefined || settings.twilioAuthToken !== undefined) {
    if (newSettings.twilioAccountSid && !oldSettings.twilioAccountSid) {
      startSmsWebhookServer();
    }
  }

  // Handle Telegram changes
  if (settings.telegramBotToken !== undefined || settings.telegramReplyEnabled !== undefined) {
    stopTelegramPolling();
    if (newSettings.telegramBotToken && newSettings.telegramReplyEnabled) {
      startTelegramPolling();
    }
  }

  // Handle Discord changes
  if (
    settings.discordBotToken !== undefined ||
    settings.discordReplyEnabled !== undefined ||
    settings.discordChannelId !== undefined
  ) {
    stopDiscordBot();
    if (newSettings.discordBotToken && newSettings.discordReplyEnabled) {
      startDiscordBot();
    }
  }

  // Notify all windows about settings change
  const popover = getPopoverWindow();
  if (popover && !popover.isDestroyed()) {
    popover.webContents.send(IPC_CHANNELS.SETTINGS_UPDATED, newSettings);
  }

  return newSettings;
});

// Sessions
ipcMain.handle(IPC_CHANNELS.GET_SESSIONS, () => {
  return getSessions();
});

// Voice
ipcMain.handle(IPC_CHANNELS.START_VOICE_INPUT, (_, sessionId: string) => {
  return startVoiceInput(sessionId);
});

ipcMain.handle(IPC_CHANNELS.STOP_VOICE_INPUT, () => {
  return stopVoiceInput();
});

ipcMain.handle(IPC_CHANNELS.SPEAK_TEXT, async (_, text: string) => {
  await speakText(text);
  return true;
});

// SMS / Twilio
ipcMain.handle(IPC_CHANNELS.SEND_SMS, async (_, message: string, toNumber?: string) => {
  return await sendSms(message, toNumber);
});

ipcMain.handle(IPC_CHANNELS.SETUP_TWILIO, async (_, webhookUrl: string) => {
  return await setupTwilio(webhookUrl);
});

ipcMain.handle(IPC_CHANNELS.GET_TWILIO_NUMBERS, async () => {
  try {
    return { success: true, numbers: await getTwilioPhoneNumbers() };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      numbers: [],
    };
  }
});

ipcMain.handle(IPC_CHANNELS.BUY_TWILIO_NUMBER, async (_, countryCode?: string) => {
  try {
    const availableNumbers = await searchAvailableNumbers(countryCode || 'US');
    if (availableNumbers.length === 0) {
      return { success: false, message: 'No phone numbers available' };
    }
    const purchased = await buyPhoneNumber(availableNumbers[0].phoneNumber);
    return { success: true, phoneNumber: purchased };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
});

// Telegram
ipcMain.handle(IPC_CHANNELS.SEND_TELEGRAM, async (_, message: string, chatId?: string) => {
  return await sendTelegram(message, chatId);
});

ipcMain.handle(IPC_CHANNELS.SETUP_TELEGRAM, async () => {
  return await setupTelegram();
});

ipcMain.handle(IPC_CHANNELS.TEST_TELEGRAM, async () => {
  return await testTelegram();
});

// Discord
ipcMain.handle(IPC_CHANNELS.SEND_DISCORD, async (_, message: string, channelId?: string) => {
  return await sendDiscord(message, channelId);
});

ipcMain.handle(IPC_CHANNELS.SETUP_DISCORD, async () => {
  return await setupDiscord();
});

ipcMain.handle(IPC_CHANNELS.TEST_DISCORD, async () => {
  return await testDiscord();
});

// Window controls
ipcMain.on(IPC_CHANNELS.OPEN_SETTINGS, () => {
  console.log('IPC: OPEN_SETTINGS received');
  createSettingsWindow();
});

ipcMain.on(IPC_CHANNELS.TOGGLE_POPOVER, () => {
  togglePopover();
});

ipcMain.on(IPC_CHANNELS.CLOSE_WINDOW, (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.close();
  }
});

// Input to session
ipcMain.handle(IPC_CHANNELS.SEND_INPUT_TO_SESSION, (_, sessionId: string, input: string) => {
  return sendInputToSession(sessionId, input);
});

// Notifications
ipcMain.on(IPC_CHANNELS.SHOW_NOTIFICATION, (_, title: string, body: string) => {
  showNotification(title, body);
});

// Handle voice input result from renderer (Web Speech API)
ipcMain.on(IPC_CHANNELS.VOICE_INPUT_RESULT, (_, sessionId: string, transcript: string) => {
  if (transcript) {
    void sendInputToSession(sessionId, transcript).then((success) => {
      if (success) {
        showNotification('Voice Input Sent', `"${transcript}" sent to Claude`);
      }
    });
  }
});

// Claude Code hook management
ipcMain.handle(IPC_CHANNELS.INSTALL_HOOKS, () => {
  return installHooks();
});

ipcMain.handle(IPC_CHANNELS.UNINSTALL_HOOKS, () => {
  return uninstallHooks();
});

ipcMain.handle(IPC_CHANNELS.GET_HOOK_STATUS, () => {
  return getHookStatus();
});

// CLI wrapper management
ipcMain.handle(IPC_CHANNELS.INSTALL_CLI, async () => {
  return await installCli();
});

ipcMain.handle(IPC_CHANNELS.UNINSTALL_CLI, async () => {
  return await uninstallCli();
});

ipcMain.handle(IPC_CHANNELS.GET_CLI_STATUS, () => {
  return getCliStatus();
});

// App lifecycle
app.on('window-all-closed', () => {
  // Don't quit when all windows are closed - we have a tray icon
  // Only quit on macOS when explicitly quitting
});

app.on('before-quit', () => {
  stopHookServer();
  stopSmsWebhookServer();
  stopTelegramPolling();
  stopDiscordBot();
  destroyTray();
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (!getPopoverWindow()) {
    const popover = createPopoverWindow();
    setPopoverWindow(popover);
    setPopoverWindowForVoice(popover);
    setMainWindowForSms(popover);
    setMainWindowForTelegram(popover);
    setMainWindowForDiscord(popover);
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
