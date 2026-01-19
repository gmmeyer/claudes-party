import { contextBridge, ipcRenderer } from 'electron';

// IPC channel names - MUST be inlined here because preload scripts can't import from other modules
// Keep in sync with src/shared/types.ts
const IPC_CHANNELS = {
  // Settings
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  SETTINGS_UPDATED: 'settings-updated',

  // Sessions
  GET_SESSIONS: 'get-sessions',
  SESSIONS_UPDATED: 'sessions-updated',

  // Voice
  START_VOICE_INPUT: 'start-voice-input',
  STOP_VOICE_INPUT: 'stop-voice-input',
  VOICE_INPUT_RESULT: 'voice-input-result',
  SPEAK_TEXT: 'speak-text',

  // SMS / Twilio
  SEND_SMS: 'send-sms',
  SMS_RECEIVED: 'sms-received',
  SETUP_TWILIO: 'setup-twilio',
  GET_TWILIO_NUMBERS: 'get-twilio-numbers',
  BUY_TWILIO_NUMBER: 'buy-twilio-number',

  // Telegram
  SEND_TELEGRAM: 'send-telegram',
  TELEGRAM_RECEIVED: 'telegram-received',
  SETUP_TELEGRAM: 'setup-telegram',
  TEST_TELEGRAM: 'test-telegram',

  // Discord
  SEND_DISCORD: 'send-discord',
  DISCORD_RECEIVED: 'discord-received',
  SETUP_DISCORD: 'setup-discord',
  TEST_DISCORD: 'test-discord',

  // Window controls
  OPEN_SETTINGS: 'open-settings',
  CLOSE_WINDOW: 'close-window',
  TOGGLE_POPOVER: 'toggle-popover',

  // Input response
  SEND_INPUT_TO_SESSION: 'send-input-to-session',

  // Notifications
  SHOW_NOTIFICATION: 'show-notification',

  // External URLs
  OPEN_EXTERNAL_URL: 'open-external-url',

  // Claude Code hook management
  INSTALL_HOOKS: 'install-hooks',
  UNINSTALL_HOOKS: 'uninstall-hooks',
  GET_HOOK_STATUS: 'get-hook-status',

  // CLI wrapper management
  INSTALL_CLI: 'install-cli',
  UNINSTALL_CLI: 'uninstall-cli',
  GET_CLI_STATUS: 'get-cli-status',
} as const;

// Type imports for TypeScript (these are erased at runtime, so this import is safe)
import type {
  AppSettings,
  ClaudeSession,
  SmsMessage,
  TelegramMessage,
  DiscordMessage,
  HookStatus,
  CliStatus,
  SetupResult,
  TwilioPhoneNumber,
} from '../shared/types';

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS) as Promise<AppSettings>,
  saveSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings) as Promise<AppSettings>,
  onSettingsUpdated: (callback: (settings: AppSettings) => void) => {
    const handler = (_: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings);
    ipcRenderer.on(IPC_CHANNELS.SETTINGS_UPDATED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SETTINGS_UPDATED, handler);
  },

  // Sessions
  getSessions: (): Promise<ClaudeSession[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SESSIONS) as Promise<ClaudeSession[]>,
  onSessionsUpdated: (callback: (sessions: ClaudeSession[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, sessions: ClaudeSession[]) => callback(sessions);
    ipcRenderer.on(IPC_CHANNELS.SESSIONS_UPDATED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SESSIONS_UPDATED, handler);
  },

  // Voice
  startVoiceInput: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.START_VOICE_INPUT, sessionId) as Promise<boolean>,
  stopVoiceInput: (): Promise<{ sessionId: string | null }> =>
    ipcRenderer.invoke(IPC_CHANNELS.STOP_VOICE_INPUT) as Promise<{
      sessionId: string | null;
    }>,
  sendVoiceInputResult: (sessionId: string, transcript: string) =>
    ipcRenderer.send(IPC_CHANNELS.VOICE_INPUT_RESULT, sessionId, transcript),
  speakText: (text: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SPEAK_TEXT, text) as Promise<boolean>,
  onStartRecording: (callback: (sessionId: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, sessionId: string) => callback(sessionId);
    ipcRenderer.on('start-recording', handler);
    return () => ipcRenderer.removeListener('start-recording', handler);
  },
  onStopRecording: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('stop-recording', handler);
    return () => ipcRenderer.removeListener('stop-recording', handler);
  },

  // SMS / Twilio
  sendSms: (message: string, toNumber?: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_SMS, message, toNumber) as Promise<boolean>,
  onSmsReceived: (callback: (message: SmsMessage) => void) => {
    const handler = (_: Electron.IpcRendererEvent, message: SmsMessage) => callback(message);
    ipcRenderer.on(IPC_CHANNELS.SMS_RECEIVED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SMS_RECEIVED, handler);
  },
  setupTwilio: (webhookUrl: string): Promise<SetupResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETUP_TWILIO, webhookUrl) as Promise<SetupResult>,
  getTwilioNumbers: (): Promise<{
    success: boolean;
    numbers: TwilioPhoneNumber[];
    message?: string;
  }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_TWILIO_NUMBERS) as Promise<{
      success: boolean;
      numbers: TwilioPhoneNumber[];
      message?: string;
    }>,
  buyTwilioNumber: (
    countryCode?: string
  ): Promise<{ success: boolean; phoneNumber?: TwilioPhoneNumber; message?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.BUY_TWILIO_NUMBER, countryCode) as Promise<{
      success: boolean;
      phoneNumber?: TwilioPhoneNumber;
      message?: string;
    }>,

  // Telegram
  sendTelegram: (message: string, chatId?: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_TELEGRAM, message, chatId) as Promise<boolean>,
  onTelegramReceived: (callback: (message: TelegramMessage) => void) => {
    const handler = (_: Electron.IpcRendererEvent, message: TelegramMessage) => callback(message);
    ipcRenderer.on(IPC_CHANNELS.TELEGRAM_RECEIVED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TELEGRAM_RECEIVED, handler);
  },
  setupTelegram: (): Promise<SetupResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETUP_TELEGRAM) as Promise<SetupResult>,
  testTelegram: (): Promise<SetupResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.TEST_TELEGRAM) as Promise<SetupResult>,

  // Discord
  sendDiscord: (message: string, channelId?: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_DISCORD, message, channelId) as Promise<boolean>,
  onDiscordReceived: (callback: (message: DiscordMessage) => void) => {
    const handler = (_: Electron.IpcRendererEvent, message: DiscordMessage) => callback(message);
    ipcRenderer.on(IPC_CHANNELS.DISCORD_RECEIVED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DISCORD_RECEIVED, handler);
  },
  setupDiscord: (): Promise<SetupResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETUP_DISCORD) as Promise<SetupResult>,
  testDiscord: (): Promise<SetupResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.TEST_DISCORD) as Promise<SetupResult>,

  // Input
  sendInputToSession: (sessionId: string, input: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_INPUT_TO_SESSION, sessionId, input) as Promise<boolean>,

  // Window controls
  openSettings: () => ipcRenderer.send(IPC_CHANNELS.OPEN_SETTINGS),
  closeWindow: () => ipcRenderer.send(IPC_CHANNELS.CLOSE_WINDOW),
  togglePopover: () => ipcRenderer.send(IPC_CHANNELS.TOGGLE_POPOVER),

  // Notifications
  showNotification: (title: string, body: string) =>
    ipcRenderer.send(IPC_CHANNELS.SHOW_NOTIFICATION, title, body),

  // External URLs
  openExternalUrl: (url: string) => ipcRenderer.send(IPC_CHANNELS.OPEN_EXTERNAL_URL, url),

  // Claude Code hook management
  installHooks: (): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.INSTALL_HOOKS) as Promise<{
      success: boolean;
      message: string;
    }>,
  uninstallHooks: (): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.UNINSTALL_HOOKS) as Promise<{
      success: boolean;
      message: string;
    }>,
  getHookStatus: (): Promise<HookStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_HOOK_STATUS) as Promise<HookStatus>,

  // CLI wrapper management
  installCli: (): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.INSTALL_CLI) as Promise<{
      success: boolean;
      message: string;
    }>,
  uninstallCli: (): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.UNINSTALL_CLI) as Promise<{
      success: boolean;
      message: string;
    }>,
  getCliStatus: (): Promise<CliStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CLI_STATUS) as Promise<CliStatus>,
});

// Type declaration for renderer
declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
      onSettingsUpdated: (callback: (settings: AppSettings) => void) => () => void;

      getSessions: () => Promise<ClaudeSession[]>;
      onSessionsUpdated: (callback: (sessions: ClaudeSession[]) => void) => () => void;

      startVoiceInput: (sessionId: string) => Promise<boolean>;
      stopVoiceInput: () => Promise<{ sessionId: string | null }>;
      sendVoiceInputResult: (sessionId: string, transcript: string) => void;
      speakText: (text: string) => Promise<boolean>;
      onStartRecording: (callback: (sessionId: string) => void) => () => void;
      onStopRecording: (callback: () => void) => () => void;

      sendSms: (message: string, toNumber?: string) => Promise<boolean>;
      onSmsReceived: (callback: (message: SmsMessage) => void) => () => void;
      setupTwilio: (webhookUrl: string) => Promise<SetupResult>;
      getTwilioNumbers: () => Promise<{
        success: boolean;
        numbers: TwilioPhoneNumber[];
        message?: string;
      }>;
      buyTwilioNumber: (countryCode?: string) => Promise<{
        success: boolean;
        phoneNumber?: TwilioPhoneNumber;
        message?: string;
      }>;

      sendTelegram: (message: string, chatId?: string) => Promise<boolean>;
      onTelegramReceived: (callback: (message: TelegramMessage) => void) => () => void;
      setupTelegram: () => Promise<SetupResult>;
      testTelegram: () => Promise<SetupResult>;

      sendDiscord: (message: string, channelId?: string) => Promise<boolean>;
      onDiscordReceived: (callback: (message: DiscordMessage) => void) => () => void;
      setupDiscord: () => Promise<SetupResult>;
      testDiscord: () => Promise<SetupResult>;

      sendInputToSession: (sessionId: string, input: string) => Promise<boolean>;

      openSettings: () => void;
      closeWindow: () => void;
      togglePopover: () => void;

      showNotification: (title: string, body: string) => void;

      openExternalUrl: (url: string) => void;

      installHooks: () => Promise<{ success: boolean; message: string }>;
      uninstallHooks: () => Promise<{ success: boolean; message: string }>;
      getHookStatus: () => Promise<HookStatus>;

      installCli: () => Promise<{ success: boolean; message: string }>;
      uninstallCli: () => Promise<{ success: boolean; message: string }>;
      getCliStatus: () => Promise<CliStatus>;
    };
  }
}
