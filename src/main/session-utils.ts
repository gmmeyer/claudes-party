/**
 * Session Utilities
 *
 * Shared utilities for session lookup and management across messaging integrations.
 * Extracted to avoid code duplication in twilio.ts, telegram.ts, and discord.ts.
 */

import { getSessions, getSession } from './sessions';
import { ClaudeSession } from '../shared/types';

export interface SessionMatch {
  id: string;
  session: ClaudeSession;
}

export interface SessionLookupResult {
  found: boolean;
  session?: SessionMatch;
  ambiguous?: boolean;
  matches?: ClaudeSession[];
  error?: string;
}

/**
 * Find a session by full or partial ID (prefix match)
 */
export function findSessionById(idPrefix: string): SessionLookupResult {
  // Try exact match first
  const exactSession = getSession(idPrefix);
  if (exactSession) {
    return {
      found: true,
      session: { id: idPrefix, session: exactSession },
    };
  }

  // Try prefix match
  const sessions = getSessions();
  const matches = sessions.filter((s) => s.id.startsWith(idPrefix));

  if (matches.length === 1) {
    return {
      found: true,
      session: { id: matches[0].id, session: matches[0] },
    };
  }

  if (matches.length > 1) {
    return {
      found: false,
      ambiguous: true,
      matches,
      error: `Multiple sessions match "${idPrefix}"`,
    };
  }

  return {
    found: false,
    error: `No session found matching "${idPrefix}"`,
  };
}

/**
 * Find the best target session for input.
 * Priority: waiting session > most recent active session
 */
export function findTargetSession(): SessionMatch | null {
  const sessions = getSessions();

  // First, try to find a waiting session
  const waitingSession = sessions.find((s) => s.status === 'waiting');
  if (waitingSession) {
    return { id: waitingSession.id, session: waitingSession };
  }

  // Fall back to most recent active session
  const activeSession = sessions
    .filter((s) => s.status === 'active')
    .sort((a, b) => b.lastActivity - a.lastActivity)[0];

  if (activeSession) {
    return { id: activeSession.id, session: activeSession };
  }

  return null;
}

/**
 * Format session list for display in messaging platforms
 */
export function formatSessionList(
  sessions: ClaudeSession[],
  format: 'markdown' | 'plain' = 'markdown'
): string {
  if (sessions.length === 0) {
    return 'No active Claude sessions.';
  }

  return sessions
    .map((s) => {
      const shortId = s.id.substring(0, 8);
      const dirName = s.workingDirectory?.split('/').pop() || 'unknown';
      const statusIcon = s.status === 'waiting' ? '⏳' : s.status === 'active' ? '🔄' : '⏹';

      if (format === 'markdown') {
        return (
          `${statusIcon} *${shortId}* (${s.status})\n` +
          `    📁 \`${dirName}\`\n` +
          (s.currentTool ? `    🔧 ${s.currentTool}\n` : '') +
          `    _/session ${shortId} <msg>_`
        );
      } else {
        return (
          `${statusIcon} ${shortId} (${s.status})\n` +
          `    📁 ${dirName}\n` +
          (s.currentTool ? `    🔧 ${s.currentTool}\n` : '') +
          `    /session ${shortId} <msg>`
        );
      }
    })
    .join('\n\n');
}

/**
 * Format ambiguous session matches for display
 */
export function formatAmbiguousMatches(
  matches: ClaudeSession[],
  idPrefix: string,
  format: 'markdown' | 'plain' = 'markdown'
): string {
  const header = `Multiple sessions match "${idPrefix}":`;
  const list = matches
    .map((s) => {
      const shortId = s.id.substring(0, 8);
      const dirName = s.workingDirectory?.split('/').pop() || 'unknown';
      if (format === 'markdown') {
        return `• \`${shortId}\` - ${dirName}`;
      } else {
        return `• ${shortId} - ${dirName}`;
      }
    })
    .join('\n');

  return `${header}\n${list}`;
}
