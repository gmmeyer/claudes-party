/**
 * Integration tests that verify multiple modules work together correctly
 */

import { HookEvent, HookType, DEFAULT_SETTINGS } from '../src/shared/types';
import {
  getSessions,
  createSession,
  processHookEvent,
  removeSession,
} from '../src/main/sessions';

describe('Integration Tests', () => {
  beforeEach(() => {
    // Clear sessions
    getSessions().forEach((s) => removeSession(s.id));
  });

  describe('Session Lifecycle', () => {
    it('should handle complete session lifecycle', () => {
      // 1. Session starts
      const startEvent: HookEvent = {
        type: 'SessionStart',
        sessionId: 'lifecycle-test',
        timestamp: Date.now(),
        data: { working_directory: '/home/user/project' },
      };
      let session = processHookEvent(startEvent);
      expect(session?.status).toBe('active');
      expect(getSessions()).toHaveLength(1);

      // 2. Tool use begins
      const preToolEvent: HookEvent = {
        type: 'PreToolUse',
        sessionId: 'lifecycle-test',
        timestamp: Date.now(),
        data: { tool_name: 'Read' },
      };
      session = processHookEvent(preToolEvent);
      expect(session?.currentTool).toBe('Read');

      // 3. Tool use completes
      const postToolEvent: HookEvent = {
        type: 'PostToolUse',
        sessionId: 'lifecycle-test',
        timestamp: Date.now(),
        data: { tool_name: 'Read' },
      };
      session = processHookEvent(postToolEvent);
      expect(session?.currentTool).toBeUndefined();

      // 4. Session ends
      const endEvent: HookEvent = {
        type: 'SessionEnd',
        sessionId: 'lifecycle-test',
        timestamp: Date.now(),
        data: {},
      };
      session = processHookEvent(endEvent);
      expect(session?.status).toBe('stopped');
    });

    it('should handle notification during session', () => {
      createSession('notify-session', '/path');

      const notifyEvent: HookEvent = {
        type: 'Notification',
        sessionId: 'notify-session',
        timestamp: Date.now(),
        data: { message: 'Waiting for input...' },
      };

      const session = processHookEvent(notifyEvent);

      expect(session?.status).toBe('waiting');
      expect(session?.lastNotification).toBe('Waiting for input...');
    });

    it('should handle multiple concurrent sessions', () => {
      // Create multiple sessions
      const sessions = ['session-1', 'session-2', 'session-3'];
      sessions.forEach((id) => {
        const event: HookEvent = {
          type: 'SessionStart',
          sessionId: id,
          timestamp: Date.now(),
          data: { working_directory: `/path/${id}` },
        };
        processHookEvent(event);
      });

      expect(getSessions()).toHaveLength(3);

      // Update each session differently
      processHookEvent({
        type: 'PreToolUse',
        sessionId: 'session-1',
        timestamp: Date.now(),
        data: { tool_name: 'Bash' },
      });

      processHookEvent({
        type: 'Notification',
        sessionId: 'session-2',
        timestamp: Date.now(),
        data: { message: 'Help needed' },
      });

      processHookEvent({
        type: 'Stop',
        sessionId: 'session-3',
        timestamp: Date.now(),
        data: { reason: 'Complete' },
      });

      // Verify each session has correct state
      const allSessions = getSessions();
      const s1 = allSessions.find((s) => s.id === 'session-1');
      const s2 = allSessions.find((s) => s.id === 'session-2');
      const s3 = allSessions.find((s) => s.id === 'session-3');

      expect(s1?.currentTool).toBe('Bash');
      expect(s2?.status).toBe('waiting');
      expect(s3?.status).toBe('stopped');
    });
  });

  describe('Event Data Flow', () => {
    it('should preserve working directory through events', () => {
      const workDir = '/important/project/path';

      processHookEvent({
        type: 'SessionStart',
        sessionId: 'preserve-test',
        timestamp: Date.now(),
        data: { working_directory: workDir },
      });

      // Multiple events shouldn't change working directory
      processHookEvent({
        type: 'PreToolUse',
        sessionId: 'preserve-test',
        timestamp: Date.now(),
        data: { tool_name: 'Edit' },
      });

      processHookEvent({
        type: 'Notification',
        sessionId: 'preserve-test',
        timestamp: Date.now(),
        data: { message: 'Test' },
      });

      const session = getSessions().find((s) => s.id === 'preserve-test');
      expect(session?.workingDirectory).toBe(workDir);
    });

    it('should track activity timestamps', async () => {
      createSession('time-test', '/path');

      const initialSession = getSessions().find((s) => s.id === 'time-test');
      const initialActivity = initialSession?.lastActivity || 0;

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 10));

      processHookEvent({
        type: 'PreToolUse',
        sessionId: 'time-test',
        timestamp: Date.now(),
        data: { tool_name: 'Read' },
      });

      const updatedSession = getSessions().find((s) => s.id === 'time-test');
      expect(updatedSession?.lastActivity).toBeGreaterThan(initialActivity);
    });
  });

  describe('Settings Validation', () => {
    it('should have consistent default settings', () => {
      // Ensure settings that depend on each other are consistent
      expect(DEFAULT_SETTINGS.voiceInputEnabled).toBe(false);
      expect(DEFAULT_SETTINGS.voiceOutputEnabled).toBe(false);
      expect(DEFAULT_SETTINGS.elevenLabsApiKey).toBe(''); // No key, so voice should be off

      expect(DEFAULT_SETTINGS.smsNotificationsEnabled).toBe(false);
      expect(DEFAULT_SETTINGS.twilioAccountSid).toBe(''); // No credentials, so SMS should be off
    });

    it('should have valid opacity range', () => {
      expect(DEFAULT_SETTINGS.popoverOpacity).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_SETTINGS.popoverOpacity).toBeLessThanOrEqual(1);
    });

    it('should have valid port range', () => {
      // Valid port range for user processes
      expect(DEFAULT_SETTINGS.hookServerPort).toBeGreaterThanOrEqual(1024);
      expect(DEFAULT_SETTINGS.hookServerPort).toBeLessThanOrEqual(65535);
    });
  });

  describe('Error Handling', () => {
    it('should handle events for non-existent sessions gracefully', () => {
      // ensureSession should create session if needed
      const event: HookEvent = {
        type: 'PreToolUse',
        sessionId: 'ghost-session',
        timestamp: Date.now(),
        data: { tool_name: 'Test' },
      };

      // This should not throw
      expect(() => processHookEvent(event)).not.toThrow();
    });

    it('should handle malformed event data', () => {
      createSession('malformed-test', '/path');

      // Missing expected fields
      const event: HookEvent = {
        type: 'PreToolUse',
        sessionId: 'malformed-test',
        timestamp: Date.now(),
        data: {}, // Missing tool_name
      };

      // Should not throw
      expect(() => processHookEvent(event)).not.toThrow();

      const session = getSessions().find((s) => s.id === 'malformed-test');
      expect(session?.currentTool).toBeUndefined(); // Gracefully handles missing data
    });
  });
});
