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

  desktopNotificationsEnabled: true,
  notifyOnSessionEnd: true,
  notifyOnError: true,
  notifyOnWaitingForInput: true,

  popoverPosition: 'top-right',
  popoverOpacity: 0.95,
  alwaysOnTop: true,

  hookServerPort: 31548
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

  // SMS
  SEND_SMS: 'send-sms',
  SMS_RECEIVED: 'sms-received',

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
  GET_HOOK_STATUS: 'get-hook-status'
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
