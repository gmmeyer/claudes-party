import { ClaudeSession, HookEvent, InputOption } from '../shared/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// In-memory store for active sessions
const sessions = new Map<string, ClaudeSession>();

// Cache for session slugs to avoid repeated file reads
const slugCache = new Map<string, string>();

/**
 * Look up the session slug from Claude's JSONL files.
 * Claude Code stores sessions at ~/.claude/projects/{ENCODED_PROJECT_PATH}/{SESSION_ID}.jsonl
 * The first line contains JSON with a "slug" field (e.g., "lexical-riding-yeti")
 */
function lookupSessionSlug(sessionId: string): string | undefined {
  // Check cache first
  if (slugCache.has(sessionId)) {
    return slugCache.get(sessionId);
  }

  try {
    const claudeDir = path.join(os.homedir(), '.claude', 'projects');

    if (!fs.existsSync(claudeDir)) {
      return undefined;
    }

    // Search through all project directories for the session file
    const projectDirs = fs.readdirSync(claudeDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const projectDir of projectDirs) {
      const sessionFile = path.join(claudeDir, projectDir, `${sessionId}.jsonl`);

      if (fs.existsSync(sessionFile)) {
        // Read just the first line to get the slug
        const content = fs.readFileSync(sessionFile, 'utf-8');
        const firstLine = content.split('\n')[0];

        if (firstLine) {
          try {
            const data = JSON.parse(firstLine);
            if (data.slug && typeof data.slug === 'string') {
              slugCache.set(sessionId, data.slug);
              return data.slug;
            }
          } catch {
            // Invalid JSON, continue searching
          }
        }
      }
    }
  } catch (error) {
    // Silently fail if we can't read the files
    console.error('Error looking up session slug:', error);
  }

  return undefined;
}

export function getSessions(): ClaudeSession[] {
  return Array.from(sessions.values());
}

export function getSession(sessionId: string): ClaudeSession | undefined {
  return sessions.get(sessionId);
}

export function createSession(sessionId: string, workingDirectory: string): ClaudeSession {
  // Look up the session slug from Claude's JSONL files
  const slug = lookupSessionSlug(sessionId);

  const session: ClaudeSession = {
    id: sessionId,
    workingDirectory,
    startTime: Date.now(),
    status: 'active',
    lastActivity: Date.now(),
    slug,
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

/**
 * Clear the waiting status for a session (called after input is sent)
 * This sets status to 'active' and clears question/options
 */
export function clearWaitingStatus(sessionId: string): ClaudeSession | undefined {
  return updateSession(sessionId, {
    status: 'active',
    question: undefined,
    options: undefined,
    lastNotification: undefined,
  });
}

/**
 * Parse options from notification data
 * Claude Code may send options in various formats
 */
function parseOptions(data: Record<string, unknown>): InputOption[] | undefined {
  // Check for options array (from AskUserQuestion tool)
  const rawOptions = data.options || data.choices || data.answers;

  if (Array.isArray(rawOptions)) {
    return rawOptions.map((opt, index) => {
      if (typeof opt === 'string') {
        return { label: opt, value: opt };
      }
      if (typeof opt === 'object' && opt !== null) {
        const o = opt as Record<string, unknown>;
        return {
          label: (o.label || o.text || o.name || String(index + 1)) as string,
          value: (o.value || o.label || o.text || String(index + 1)) as string,
          description: o.description as string | undefined,
        };
      }
      return { label: String(opt), value: String(opt) };
    });
  }

  return undefined;
}

// Try to get a friendly name from the working directory
function getProjectName(workingDirectory: string): string {
  if (!workingDirectory || workingDirectory === 'Unknown') {
    return 'Unknown';
  }
  // Get the last part of the path as the project name
  const parts = workingDirectory.split('/').filter(Boolean);
  return parts[parts.length - 1] || workingDirectory;
}

export function processHookEvent(event: HookEvent): ClaudeSession | undefined {
  const { type, sessionId, data } = event;

  // Try to update working directory if we have it and current is Unknown
  const session = sessions.get(sessionId);
  if (session) {
    if (session.workingDirectory === 'Unknown' && data.working_directory) {
      session.workingDirectory = data.working_directory;
    }
    // Try to look up slug if we don't have it yet (file may have been created after session started)
    if (!session.slug) {
      session.slug = lookupSessionSlug(sessionId);
    }
    sessions.set(sessionId, session);
  }

  switch (type) {
    case 'SessionStart':
      return createSession(sessionId, data.working_directory || 'Unknown');

    case 'SessionEnd':
      updateSession(sessionId, { status: 'stopped' });
      // Keep session visible for a bit before removing
      setTimeout(() => removeSession(sessionId), 30000);
      return getSession(sessionId);

    case 'PreToolUse':
      // Clear waiting state when Claude starts using a tool
      return updateSession(sessionId, {
        status: 'active',
        currentTool: data.tool_name,
        question: undefined,
        options: undefined,
        lastNotification: undefined,
      });

    case 'PostToolUse':
      // Clear waiting state after tool use
      return updateSession(sessionId, {
        status: 'active',
        currentTool: undefined,
        question: undefined,
        options: undefined,
        lastNotification: undefined,
      });

    case 'Notification':
      // Extract notification data - may contain question and options
      const notifData = data as Record<string, unknown>;
      const notificationMsg = (notifData.message || notifData.title || notifData.body || notifData.text || 'Waiting for input...') as string;
      const question = (notifData.question || notifData.prompt || notificationMsg) as string;
      const options = parseOptions(notifData);

      return updateSession(sessionId, {
        status: 'waiting',
        lastNotification: notificationMsg,
        question,
        options,
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
