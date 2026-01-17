import { ClaudeSession, HookEvent } from '../shared/types';

// In-memory store for active sessions
const sessions = new Map<string, ClaudeSession>();

export function getSessions(): ClaudeSession[] {
  return Array.from(sessions.values());
}

export function getSession(sessionId: string): ClaudeSession | undefined {
  return sessions.get(sessionId);
}

export function createSession(sessionId: string, workingDirectory: string): ClaudeSession {
  const session: ClaudeSession = {
    id: sessionId,
    workingDirectory,
    startTime: Date.now(),
    status: 'active',
    lastActivity: Date.now(),
  };
  sessions.set(sessionId, session);
  return session;
}

export function updateSession(
  sessionId: string,
  updates: Partial<ClaudeSession>
): ClaudeSession | undefined {
  const session = sessions.get(sessionId);
  if (session) {
    const updated = { ...session, ...updates, lastActivity: Date.now() };
    sessions.set(sessionId, updated);
    return updated;
  }
  return undefined;
}

export function removeSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function processHookEvent(event: HookEvent): ClaudeSession | undefined {
  const { type, sessionId, data } = event;

  switch (type) {
    case 'SessionStart':
      return createSession(sessionId, data.working_directory || 'Unknown');

    case 'SessionEnd':
      updateSession(sessionId, { status: 'stopped' });
      // Keep session visible for a bit before removing
      setTimeout(() => removeSession(sessionId), 30000);
      return getSession(sessionId);

    case 'PreToolUse':
      return updateSession(sessionId, {
        status: 'active',
        currentTool: data.tool_name,
      });

    case 'PostToolUse':
      return updateSession(sessionId, {
        status: 'active',
        currentTool: undefined,
      });

    case 'Notification':
      return updateSession(sessionId, {
        status: 'waiting',
        lastNotification: data.message,
      });

    case 'Stop':
      return updateSession(sessionId, {
        status: 'stopped',
        currentTool: undefined,
      });

    default:
      return getSession(sessionId);
  }
}

// Auto-create session if we receive an event for unknown session
export function ensureSession(sessionId: string): ClaudeSession {
  let session = sessions.get(sessionId);
  if (!session) {
    session = createSession(sessionId, 'Unknown');
  }
  return session;
}
