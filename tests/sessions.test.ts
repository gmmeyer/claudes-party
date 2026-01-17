import {
  getSessions,
  getSession,
  createSession,
  updateSession,
  removeSession,
  processHookEvent,
  ensureSession,
} from '../src/main/sessions';
import { HookEvent } from '../src/shared/types';

describe('Sessions Module', () => {
  beforeEach(() => {
    // Clear all sessions before each test
    const sessions = getSessions();
    sessions.forEach((s) => removeSession(s.id));
  });

  describe('createSession', () => {
    it('should create a new session with correct properties', () => {
      const session = createSession('test-123', '/home/user/project');

      expect(session.id).toBe('test-123');
      expect(session.workingDirectory).toBe('/home/user/project');
      expect(session.status).toBe('active');
      expect(session.startTime).toBeLessThanOrEqual(Date.now());
      expect(session.lastActivity).toBeLessThanOrEqual(Date.now());
    });

    it('should add session to the sessions list', () => {
      createSession('test-456', '/tmp');

      const sessions = getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('test-456');
    });

    it('should allow multiple sessions', () => {
      createSession('session-1', '/path/1');
      createSession('session-2', '/path/2');
      createSession('session-3', '/path/3');

      expect(getSessions()).toHaveLength(3);
    });
  });

  describe('getSession', () => {
    it('should return session by ID', () => {
      createSession('find-me', '/somewhere');

      const session = getSession('find-me');
      expect(session).toBeDefined();
      expect(session?.id).toBe('find-me');
    });

    it('should return undefined for non-existent session', () => {
      const session = getSession('does-not-exist');
      expect(session).toBeUndefined();
    });
  });

  describe('updateSession', () => {
    it('should update session properties', () => {
      createSession('update-me', '/initial');

      const updated = updateSession('update-me', {
        status: 'waiting',
        currentTool: 'Bash',
      });

      expect(updated).toBeDefined();
      expect(updated?.status).toBe('waiting');
      expect(updated?.currentTool).toBe('Bash');
      expect(updated?.workingDirectory).toBe('/initial'); // Unchanged
    });

    it('should update lastActivity timestamp', () => {
      const session = createSession('activity-test', '/path');
      const originalActivity = session.lastActivity;

      // Small delay to ensure different timestamp
      const updated = updateSession('activity-test', { status: 'waiting' });

      expect(updated?.lastActivity).toBeGreaterThanOrEqual(originalActivity);
    });

    it('should return undefined for non-existent session', () => {
      const result = updateSession('ghost', { status: 'stopped' });
      expect(result).toBeUndefined();
    });
  });

  describe('removeSession', () => {
    it('should remove session from list', () => {
      createSession('to-remove', '/tmp');
      expect(getSessions()).toHaveLength(1);

      const removed = removeSession('to-remove');

      expect(removed).toBe(true);
      expect(getSessions()).toHaveLength(0);
    });

    it('should return false for non-existent session', () => {
      const removed = removeSession('not-here');
      expect(removed).toBe(false);
    });
  });

  describe('ensureSession', () => {
    it('should return existing session', () => {
      const original = createSession('existing', '/path');

      const session = ensureSession('existing');

      expect(session.id).toBe('existing');
      expect(session.startTime).toBe(original.startTime);
    });

    it('should create new session if not exists', () => {
      expect(getSession('new-session')).toBeUndefined();

      const session = ensureSession('new-session');

      expect(session.id).toBe('new-session');
      expect(session.workingDirectory).toBe('Unknown');
    });
  });

  describe('processHookEvent', () => {
    it('should handle SessionStart event', () => {
      const event: HookEvent = {
        type: 'SessionStart',
        sessionId: 'new-session',
        timestamp: Date.now(),
        data: {
          working_directory: '/home/user/code',
        },
      };

      const session = processHookEvent(event);

      expect(session).toBeDefined();
      expect(session?.id).toBe('new-session');
      expect(session?.workingDirectory).toBe('/home/user/code');
      expect(session?.status).toBe('active');
    });

    it('should handle PreToolUse event', () => {
      createSession('tool-session', '/path');

      const event: HookEvent = {
        type: 'PreToolUse',
        sessionId: 'tool-session',
        timestamp: Date.now(),
        data: {
          tool_name: 'Read',
        },
      };

      const session = processHookEvent(event);

      expect(session?.status).toBe('active');
      expect(session?.currentTool).toBe('Read');
    });

    it('should handle PostToolUse event', () => {
      createSession('post-tool', '/path');
      updateSession('post-tool', { currentTool: 'Write' });

      const event: HookEvent = {
        type: 'PostToolUse',
        sessionId: 'post-tool',
        timestamp: Date.now(),
        data: {},
      };

      const session = processHookEvent(event);

      expect(session?.status).toBe('active');
      expect(session?.currentTool).toBeUndefined();
    });

    it('should handle Notification event', () => {
      createSession('notify-session', '/path');

      const event: HookEvent = {
        type: 'Notification',
        sessionId: 'notify-session',
        timestamp: Date.now(),
        data: {
          message: 'Waiting for user input...',
        },
      };

      const session = processHookEvent(event);

      expect(session?.status).toBe('waiting');
      expect(session?.lastNotification).toBe('Waiting for user input...');
    });

    it('should handle Stop event', () => {
      createSession('stop-session', '/path');

      const event: HookEvent = {
        type: 'Stop',
        sessionId: 'stop-session',
        timestamp: Date.now(),
        data: {
          reason: 'Task completed',
        },
      };

      const session = processHookEvent(event);

      expect(session?.status).toBe('stopped');
      expect(session?.currentTool).toBeUndefined();
    });

    it('should handle SessionEnd event', () => {
      createSession('end-session', '/path');

      const event: HookEvent = {
        type: 'SessionEnd',
        sessionId: 'end-session',
        timestamp: Date.now(),
        data: {},
      };

      const session = processHookEvent(event);

      expect(session?.status).toBe('stopped');
    });
  });
});
