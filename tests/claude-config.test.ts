import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getClaudeSettingsPath,
  generateHookCommands,
  readClaudeSettings,
  writeClaudeSettings,
  installHooks,
  uninstallHooks,
  areHooksInstalled,
  getHookStatus,
} from '../src/main/claude-config';

// Mock the store module
jest.mock('../src/main/store', () => ({
  getSettings: jest.fn(),
}));

import { getSettings } from '../src/main/store';

describe('Claude Config Module', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockGetSettings = getSettings as jest.MockedFunction<typeof getSettings>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish mock implementations
    mockGetSettings.mockReturnValue({
      hookServerPort: 31548,
      elevenLabsApiKey: '',
      elevenLabsVoiceId: '',
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
    });
    // Reset fs mocks
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.writeFileSync.mockImplementation(() => undefined);
    mockFs.mkdirSync.mockImplementation(() => undefined);
  });

  describe('getClaudeSettingsPath', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return correct path for macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const settingsPath = getClaudeSettingsPath();

      expect(settingsPath).toContain('Library');
      expect(settingsPath).toContain('Application Support');
      expect(settingsPath).toContain('Claude');
      expect(settingsPath.endsWith('settings.json')).toBe(true);
    });

    it('should return correct path for Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const settingsPath = getClaudeSettingsPath();

      expect(settingsPath).toContain('.config');
      expect(settingsPath).toContain('claude');
      expect(settingsPath.endsWith('settings.json')).toBe(true);
    });

    it('should return correct path for Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const settingsPath = getClaudeSettingsPath();

      expect(settingsPath).toContain('Claude');
      expect(settingsPath.endsWith('settings.json')).toBe(true);
    });
  });

  describe('generateHookCommands', () => {
    it('should generate commands for all hook types', () => {
      const commands = generateHookCommands();

      expect(commands).toHaveProperty('PreToolUse');
      expect(commands).toHaveProperty('PostToolUse');
      expect(commands).toHaveProperty('Notification');
      expect(commands).toHaveProperty('Stop');
      expect(commands).toHaveProperty('SessionStart');
      expect(commands).toHaveProperty('SessionEnd');
    });

    it('should include port number in commands', () => {
      const commands = generateHookCommands();

      Object.values(commands).forEach((cmdArray) => {
        expect(cmdArray[0]).toContain('31548');
      });
    });

    it('should use curl with correct options', () => {
      const commands = generateHookCommands();

      Object.values(commands).forEach((cmdArray) => {
        const cmd = cmdArray[0];
        expect(cmd).toContain('curl');
        expect(cmd).toContain('-s'); // Silent mode
        expect(cmd).toContain('-X POST');
        expect(cmd).toContain("Content-Type: application/json");
        expect(cmd).toContain('-d @-'); // Read from stdin
        expect(cmd).toContain('2>/dev/null || true'); // Fail silently
      });
    });

    it('should include correct endpoint paths', () => {
      const commands = generateHookCommands();

      expect(commands.PreToolUse[0]).toContain('/PreToolUse');
      expect(commands.PostToolUse[0]).toContain('/PostToolUse');
      expect(commands.Notification[0]).toContain('/Notification');
      expect(commands.Stop[0]).toContain('/Stop');
      expect(commands.SessionStart[0]).toContain('/SessionStart');
      expect(commands.SessionEnd[0]).toContain('/SessionEnd');
    });
  });

  describe('readClaudeSettings', () => {
    it('should return null if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const settings = readClaudeSettings();

      expect(settings).toBeNull();
    });

    it('should parse and return JSON from file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          theme: 'dark',
          hooks: {},
        })
      );

      const settings = readClaudeSettings();

      expect(settings).toEqual({
        theme: 'dark',
        hooks: {},
      });
    });

    it('should return null on parse error', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json {{{');

      const settings = readClaudeSettings();

      expect(settings).toBeNull();
    });
  });

  describe('writeClaudeSettings', () => {
    it('should create directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      writeClaudeSettings({ test: 'value' });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('should write formatted JSON to file', () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = writeClaudeSettings({ hooks: {}, custom: 'setting' });

      expect(result).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"hooks"'),
        'utf-8'
      );
    });

    it('should return false on write error', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = writeClaudeSettings({ test: 'value' });

      expect(result).toBe(false);
    });
  });

  describe('installHooks', () => {
    it('should create new settings file if none exists', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = installHooks();

      expect(result.success).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should merge with existing hooks', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          hooks: {
            PreToolUse: ['existing-command'],
          },
        })
      );

      installHooks();

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1] as string);

      // Should have our hook added
      expect(writtenContent.hooks.PreToolUse.length).toBeGreaterThanOrEqual(1);
      // Should have all hook types
      expect(writtenContent.hooks).toHaveProperty('SessionStart');
      expect(writtenContent.hooks).toHaveProperty('SessionEnd');
    });

    it('should return error message on failure', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');
      // Make writeFileSync fail to trigger error path
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });

      const result = installHooks();

      expect(result.success).toBe(false);
      // Message should indicate failure
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('uninstallHooks', () => {
    it('should return success if no settings file', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = uninstallHooks();

      expect(result.success).toBe(true);
    });

    it('should remove our hooks but keep others', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          hooks: {
            PreToolUse: [
              'curl -s -X POST http://127.0.0.1:31548/PreToolUse -d @-',
              'other-command',
            ],
            CustomHook: ['custom-command'],
          },
        })
      );

      uninstallHooks();

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1] as string);

      // Our hook should be removed
      expect(writtenContent.hooks.PreToolUse).not.toContain(
        expect.stringContaining('127.0.0.1:31548')
      );
      // Other commands should remain
      expect(writtenContent.hooks.PreToolUse).toContain('other-command');
      expect(writtenContent.hooks.CustomHook).toEqual(['custom-command']);
    });
  });

  describe('areHooksInstalled', () => {
    it('should return false if no settings file', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(areHooksInstalled()).toBe(false);
    });

    it('should return false if no hooks in settings', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({}));

      expect(areHooksInstalled()).toBe(false);
    });

    it('should return true if our hooks are present', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          hooks: {
            PreToolUse: ['curl -s -X POST http://127.0.0.1:31548/PreToolUse -d @-'],
          },
        })
      );

      expect(areHooksInstalled()).toBe(true);
    });

    it('should return false if only other hooks present', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          hooks: {
            PreToolUse: ['some-other-hook'],
          },
        })
      );

      expect(areHooksInstalled()).toBe(false);
    });
  });

  describe('getHookStatus', () => {
    it('should return complete status object', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          hooks: {
            PreToolUse: ['curl -s -X POST http://127.0.0.1:31548/PreToolUse -d @-'],
            PostToolUse: ['curl -s -X POST http://127.0.0.1:31548/PostToolUse -d @-'],
          },
        })
      );

      const status = getHookStatus();

      expect(status).toHaveProperty('installed');
      expect(status).toHaveProperty('settingsPath');
      expect(status).toHaveProperty('settingsExist');
      expect(status).toHaveProperty('hookTypes');
      expect(status.installed).toBe(true);
      expect(status.settingsExist).toBe(true);
      expect(status.hookTypes).toContain('PreToolUse');
      expect(status.hookTypes).toContain('PostToolUse');
    });

    it('should report not installed when no hooks', () => {
      mockFs.existsSync.mockReturnValue(false);

      const status = getHookStatus();

      expect(status.installed).toBe(false);
      expect(status.settingsExist).toBe(false);
      expect(status.hookTypes).toEqual([]);
    });
  });
});
