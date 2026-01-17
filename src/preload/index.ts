import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, AppSettings, ClaudeSession, SmsMessage } from '../shared/types';

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  saveSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
  onSettingsUpdated: (callback: (settings: AppSettings) => void) => {
    const handler = (_: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings);
    ipcRenderer.on(IPC_CHANNELS.SETTINGS_UPDATED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SETTINGS_UPDATED, handler);
  },

  // Sessions
  getSessions: (): Promise<ClaudeSession[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_SESSIONS),
  onSessionsUpdated: (callback: (sessions: ClaudeSession[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, sessions: ClaudeSession[]) => callback(sessions);
    ipcRenderer.on(IPC_CHANNELS.SESSIONS_UPDATED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SESSIONS_UPDATED, handler);
  },
  onSessionEvent: (callback: (event: unknown) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: unknown) => callback(event);
    ipcRenderer.on(IPC_CHANNELS.SESSION_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SESSION_EVENT, handler);
  },

  // Voice
  startVoiceInput: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.START_VOICE_INPUT, sessionId),
  stopVoiceInput: (): Promise<{ sessionId: string | null }> =>
    ipcRenderer.invoke(IPC_CHANNELS.STOP_VOICE_INPUT),
  sendVoiceInputResult: (sessionId: string, transcript: string) =>
    ipcRenderer.send(IPC_CHANNELS.VOICE_INPUT_RESULT, sessionId, transcript),
  speakText: (text: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SPEAK_TEXT, text),
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

  // SMS
  sendSms: (message: string, toNumber?: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_SMS, message, toNumber),
  onSmsReceived: (callback: (message: SmsMessage) => void) => {
    const handler = (_: Electron.IpcRendererEvent, message: SmsMessage) => callback(message);
    ipcRenderer.on(IPC_CHANNELS.SMS_RECEIVED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SMS_RECEIVED, handler);
  },

  // Input
  sendInputToSession: (sessionId: string, input: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_INPUT_TO_SESSION, sessionId, input),

  // Window controls
  openSettings: () => ipcRenderer.send(IPC_CHANNELS.OPEN_SETTINGS),
  closeWindow: () => ipcRenderer.send(IPC_CHANNELS.CLOSE_WINDOW),
  togglePopover: () => ipcRenderer.send(IPC_CHANNELS.TOGGLE_POPOVER),

  // Notifications
  showNotification: (title: string, body: string) =>
    ipcRenderer.send(IPC_CHANNELS.SHOW_NOTIFICATION, title, body)
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
      onSessionEvent: (callback: (event: unknown) => void) => () => void;

      startVoiceInput: (sessionId: string) => Promise<boolean>;
      stopVoiceInput: () => Promise<{ sessionId: string | null }>;
      sendVoiceInputResult: (sessionId: string, transcript: string) => void;
      speakText: (text: string) => Promise<boolean>;
      onStartRecording: (callback: (sessionId: string) => void) => () => void;
      onStopRecording: (callback: () => void) => () => void;

      sendSms: (message: string, toNumber?: string) => Promise<boolean>;
      onSmsReceived: (callback: (message: SmsMessage) => void) => () => void;

      sendInputToSession: (sessionId: string, input: string) => Promise<boolean>;

      openSettings: () => void;
      closeWindow: () => void;
      togglePopover: () => void;

      showNotification: (title: string, body: string) => void;
    };
  }
}
