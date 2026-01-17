import { getSettings, saveSettings, resetSettings } from '../src/main/store';
import { DEFAULT_SETTINGS, AppSettings } from '../src/shared/types';

describe('Store Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return default settings initially', () => {
      const settings = getSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should return object with all required properties', () => {
      const settings = getSettings();

      // ElevenLabs
      expect(settings).toHaveProperty('elevenLabsApiKey');
      expect(settings).toHaveProperty('elevenLabsVoiceId');
      expect(settings).toHaveProperty('voiceInputEnabled');
      expect(settings).toHaveProperty('voiceOutputEnabled');

      // Twilio
      expect(settings).toHaveProperty('twilioAccountSid');
      expect(settings).toHaveProperty('twilioAuthToken');
      expect(settings).toHaveProperty('twilioPhoneNumber');
      expect(settings).toHaveProperty('userPhoneNumber');
      expect(settings).toHaveProperty('smsNotificationsEnabled');

      // Notifications
      expect(settings).toHaveProperty('desktopNotificationsEnabled');
      expect(settings).toHaveProperty('notifyOnSessionEnd');
      expect(settings).toHaveProperty('notifyOnError');
      expect(settings).toHaveProperty('notifyOnWaitingForInput');

      // UI
      expect(settings).toHaveProperty('popoverPosition');
      expect(settings).toHaveProperty('popoverOpacity');
      expect(settings).toHaveProperty('alwaysOnTop');

      // Hook server
      expect(settings).toHaveProperty('hookServerPort');
    });
  });

  describe('saveSettings', () => {
    it('should merge partial settings with existing', () => {
      const newSettings = saveSettings({
        elevenLabsApiKey: 'new-api-key',
        voiceOutputEnabled: true,
      });

      expect(newSettings.elevenLabsApiKey).toBe('new-api-key');
      expect(newSettings.voiceOutputEnabled).toBe(true);
      // Other settings should remain at defaults
      expect(newSettings.hookServerPort).toBe(DEFAULT_SETTINGS.hookServerPort);
    });

    it('should return complete settings object', () => {
      const result = saveSettings({ popoverPosition: 'bottom-left' });

      // Should have all properties
      expect(Object.keys(result).length).toBe(Object.keys(DEFAULT_SETTINGS).length);
    });

    it('should handle empty update', () => {
      const result = saveSettings({});

      expect(result).toEqual(DEFAULT_SETTINGS);
    });

    it('should allow updating all settings at once', () => {
      const fullUpdate: AppSettings = {
        ...DEFAULT_SETTINGS,
        elevenLabsApiKey: 'test-key',
        twilioAccountSid: 'AC123',
        popoverPosition: 'top-left',
        hookServerPort: 9999,
      };

      const result = saveSettings(fullUpdate);

      expect(result.elevenLabsApiKey).toBe('test-key');
      expect(result.twilioAccountSid).toBe('AC123');
      expect(result.popoverPosition).toBe('top-left');
      expect(result.hookServerPort).toBe(9999);
    });
  });

  describe('resetSettings', () => {
    it('should return default settings', () => {
      const result = resetSettings();

      expect(result).toEqual(DEFAULT_SETTINGS);
    });

    it('should reset after custom settings were saved', () => {
      // First save some custom settings
      saveSettings({
        elevenLabsApiKey: 'custom-key',
        hookServerPort: 12345,
      });

      // Then reset
      const result = resetSettings();

      expect(result).toEqual(DEFAULT_SETTINGS);
      expect(result.elevenLabsApiKey).toBe('');
      expect(result.hookServerPort).toBe(31548);
    });
  });
});
