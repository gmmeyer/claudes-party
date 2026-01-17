import { DEFAULT_SETTINGS, IPC_CHANNELS, AppSettings } from '../src/shared/types';

describe('Types Module', () => {
  describe('DEFAULT_SETTINGS', () => {
    it('should have all required ElevenLabs settings', () => {
      expect(DEFAULT_SETTINGS).toHaveProperty('elevenLabsApiKey');
      expect(DEFAULT_SETTINGS).toHaveProperty('elevenLabsVoiceId');
      expect(DEFAULT_SETTINGS).toHaveProperty('voiceInputEnabled');
      expect(DEFAULT_SETTINGS).toHaveProperty('voiceOutputEnabled');
    });

    it('should have all required Twilio settings', () => {
      expect(DEFAULT_SETTINGS).toHaveProperty('twilioAccountSid');
      expect(DEFAULT_SETTINGS).toHaveProperty('twilioAuthToken');
      expect(DEFAULT_SETTINGS).toHaveProperty('twilioPhoneNumber');
      expect(DEFAULT_SETTINGS).toHaveProperty('userPhoneNumber');
      expect(DEFAULT_SETTINGS).toHaveProperty('smsNotificationsEnabled');
    });

    it('should have all required notification settings', () => {
      expect(DEFAULT_SETTINGS).toHaveProperty('desktopNotificationsEnabled');
      expect(DEFAULT_SETTINGS).toHaveProperty('notifyOnSessionEnd');
      expect(DEFAULT_SETTINGS).toHaveProperty('notifyOnError');
      expect(DEFAULT_SETTINGS).toHaveProperty('notifyOnWaitingForInput');
    });

    it('should have all required UI settings', () => {
      expect(DEFAULT_SETTINGS).toHaveProperty('popoverPosition');
      expect(DEFAULT_SETTINGS).toHaveProperty('popoverOpacity');
      expect(DEFAULT_SETTINGS).toHaveProperty('alwaysOnTop');
    });

    it('should have hook server settings', () => {
      expect(DEFAULT_SETTINGS).toHaveProperty('hookServerPort');
      expect(DEFAULT_SETTINGS.hookServerPort).toBe(31548);
    });

    it('should have sensible default values', () => {
      // Voice/SMS disabled by default (requires API keys)
      expect(DEFAULT_SETTINGS.voiceInputEnabled).toBe(false);
      expect(DEFAULT_SETTINGS.voiceOutputEnabled).toBe(false);
      expect(DEFAULT_SETTINGS.smsNotificationsEnabled).toBe(false);

      // Desktop notifications enabled by default
      expect(DEFAULT_SETTINGS.desktopNotificationsEnabled).toBe(true);
      expect(DEFAULT_SETTINGS.notifyOnSessionEnd).toBe(true);
      expect(DEFAULT_SETTINGS.notifyOnError).toBe(true);
      expect(DEFAULT_SETTINGS.notifyOnWaitingForInput).toBe(true);

      // UI defaults
      expect(DEFAULT_SETTINGS.popoverPosition).toBe('top-right');
      expect(DEFAULT_SETTINGS.popoverOpacity).toBe(0.95);
      expect(DEFAULT_SETTINGS.alwaysOnTop).toBe(true);

      // Empty API keys
      expect(DEFAULT_SETTINGS.elevenLabsApiKey).toBe('');
      expect(DEFAULT_SETTINGS.twilioAccountSid).toBe('');
      expect(DEFAULT_SETTINGS.twilioAuthToken).toBe('');
    });

    it('should have valid popover opacity range', () => {
      expect(DEFAULT_SETTINGS.popoverOpacity).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_SETTINGS.popoverOpacity).toBeLessThanOrEqual(1);
    });

    it('should have valid port number', () => {
      expect(DEFAULT_SETTINGS.hookServerPort).toBeGreaterThanOrEqual(1024);
      expect(DEFAULT_SETTINGS.hookServerPort).toBeLessThanOrEqual(65535);
    });
  });

  describe('IPC_CHANNELS', () => {
    it('should have settings channels', () => {
      expect(IPC_CHANNELS.GET_SETTINGS).toBe('get-settings');
      expect(IPC_CHANNELS.SAVE_SETTINGS).toBe('save-settings');
      expect(IPC_CHANNELS.SETTINGS_UPDATED).toBe('settings-updated');
    });

    it('should have session channels', () => {
      expect(IPC_CHANNELS.GET_SESSIONS).toBe('get-sessions');
      expect(IPC_CHANNELS.SESSIONS_UPDATED).toBe('sessions-updated');
      expect(IPC_CHANNELS.SESSION_EVENT).toBe('session-event');
    });

    it('should have voice channels', () => {
      expect(IPC_CHANNELS.START_VOICE_INPUT).toBe('start-voice-input');
      expect(IPC_CHANNELS.STOP_VOICE_INPUT).toBe('stop-voice-input');
      expect(IPC_CHANNELS.VOICE_INPUT_RESULT).toBe('voice-input-result');
      expect(IPC_CHANNELS.SPEAK_TEXT).toBe('speak-text');
    });

    it('should have SMS channels', () => {
      expect(IPC_CHANNELS.SEND_SMS).toBe('send-sms');
      expect(IPC_CHANNELS.SMS_RECEIVED).toBe('sms-received');
    });

    it('should have window control channels', () => {
      expect(IPC_CHANNELS.OPEN_SETTINGS).toBe('open-settings');
      expect(IPC_CHANNELS.CLOSE_WINDOW).toBe('close-window');
      expect(IPC_CHANNELS.TOGGLE_POPOVER).toBe('toggle-popover');
    });

    it('should have hook management channels', () => {
      expect(IPC_CHANNELS.INSTALL_HOOKS).toBe('install-hooks');
      expect(IPC_CHANNELS.UNINSTALL_HOOKS).toBe('uninstall-hooks');
      expect(IPC_CHANNELS.GET_HOOK_STATUS).toBe('get-hook-status');
    });

    it('should have unique channel names', () => {
      const values = Object.values(IPC_CHANNELS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('AppSettings type validation', () => {
    it('should accept valid settings object', () => {
      const validSettings: AppSettings = {
        elevenLabsApiKey: 'test-key',
        elevenLabsVoiceId: 'voice-id',
        voiceInputEnabled: true,
        voiceOutputEnabled: false,
        twilioAccountSid: 'AC123',
        twilioAuthToken: 'token',
        twilioPhoneNumber: '+1234567890',
        userPhoneNumber: '+0987654321',
        smsNotificationsEnabled: true,
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
        notifyOnError: false,
        notifyOnWaitingForInput: true,
        popoverPosition: 'bottom-left',
        popoverOpacity: 0.8,
        alwaysOnTop: false,
        hookServerPort: 8080,
      };

      // TypeScript will enforce this at compile time
      expect(validSettings.popoverPosition).toBe('bottom-left');
    });

    it('should enforce popover position enum', () => {
      const positions: AppSettings['popoverPosition'][] = [
        'top-right',
        'top-left',
        'bottom-right',
        'bottom-left',
      ];

      positions.forEach((pos) => {
        expect(['top-right', 'top-left', 'bottom-right', 'bottom-left']).toContain(pos);
      });
    });
  });
});
