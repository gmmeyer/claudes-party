// Types for Claude Code hooks
export type HookType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'Stop'
  | 'SessionStart'
  | 'SessionEnd';

export interface ClaudeSession {
  id: string;
  workingDirectory: string;
  startTime: number;
  status: 'active' | 'waiting' | 'stopped';
  lastActivity: number;
  currentTool?: string;
  lastNotification?: string;
}

export interface HookEvent {
  type: HookType;
  sessionId: string;
  timestamp: number;
  data: HookEventData;
}

export interface HookEventData {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  message?: string;
  working_directory?: string;
  session_id?: string;
  reason?: string;
}

// Settings types
export interface AppSettings {
  // ElevenLabs settings
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;

  // Twilio settings
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  userPhoneNumber: string;
  smsNotificationsEnabled: boolean;
  smsReplyEnabled: boolean;
  twilioWebhookUrl: string;

  // Telegram settings
  telegramBotToken: string;
  telegramChatId: string;
  telegramNotificationsEnabled: boolean;
  telegramReplyEnabled: boolean;

  // Discord settings
  discordWebhookUrl: string;
  discordBotToken: string;
  discordChannelId: string;
  discordNotificationsEnabled: boolean;
  discordReplyEnabled: boolean;

  // Notification settings
  desktopNotificationsEnabled: boolean;
  notifyOnSessionEnd: boolean;
  notifyOnError: boolean;
  notifyOnWaitingForInput: boolean;

  // UI settings
  popoverPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  popoverOpacity: number;
  alwaysOnTop: boolean;

  // Hook server settings
  hookServerPort: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  elevenLabsApiKey: '',
  elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL', // Default voice
  voiceInputEnabled: false,
  voiceOutputEnabled: false,

  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioPhoneNumber: '',
  userPhoneNumber: '',
  smsNotificationsEnabled: false,
  smsReplyEnabled: true,
  twilioWebhookUrl: '',

  telegramBotToken: '',
  telegramChatId: '',
  telegramNotificationsEnabled: false,
  telegramReplyEnabled: true,

  discordWebhookUrl: '',
  discordBotToken: '',
  discordChannelId: '',
  discordNotificationsEnabled: false,
  discordReplyEnabled: true,

  desktopNotificationsEnabled: true,
  notifyOnSessionEnd: true,
  notifyOnError: true,
  notifyOnWaitingForInput: true,

  popoverPosition: 'top-right',
  popoverOpacity: 0.95,
  alwaysOnTop: true,

  hookServerPort: 31548,
};

// IPC channel names
export const IPC_CHANNELS = {
  // Settings
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  SETTINGS_UPDATED: 'settings-updated',

  // Sessions
  GET_SESSIONS: 'get-sessions',
  SESSIONS_UPDATED: 'sessions-updated',
  SESSION_EVENT: 'session-event',

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

  // Claude Code hook management
  INSTALL_HOOKS: 'install-hooks',
  UNINSTALL_HOOKS: 'uninstall-hooks',
  GET_HOOK_STATUS: 'get-hook-status',
} as const;

// Hook status response
export interface HookStatus {
  installed: boolean;
  settingsPath: string;
  settingsExist: boolean;
  hookTypes: string[];
}

// Voice input state
export interface VoiceInputState {
  isRecording: boolean;
  sessionId?: string;
  transcript?: string;
}

// SMS message
export interface SmsMessage {
  from: string;
  to: string;
  body: string;
  timestamp: number;
  direction: 'inbound' | 'outbound';
}

// Telegram message
export interface TelegramMessage {
  chatId: string;
  messageId?: number;
  text: string;
  timestamp: number;
  direction: 'inbound' | 'outbound';
  username?: string;
}

// Discord message
export interface DiscordMessage {
  channelId: string;
  messageId?: string;
  content: string;
  timestamp: number;
  direction: 'inbound' | 'outbound';
  username?: string;
}

// Twilio phone number info
export interface TwilioPhoneNumber {
  phoneNumber: string;
  friendlyName: string;
  capabilities: {
    sms: boolean;
    voice: boolean;
    mms: boolean;
  };
  country: string;
}

// Available phone number for purchase
export interface TwilioAvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  country: string;
  capabilities: {
    sms: boolean;
    voice: boolean;
    mms: boolean;
  };
}

// Setup result types
export interface SetupResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}
