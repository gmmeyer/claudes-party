import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getSettings } from './store';
import { log } from './logger';

// Get Claude Code settings file path - uses ~/.claude/settings.json on all platforms
export function getClaudeSettingsPath(): string {
  const home = os.homedir();
  return path.join(home, '.claude', 'settings.json');
}

// Hook entry in new Claude Code format
interface HookCommand {
  type: string;
  command: string;
  timeout?: number;
}

interface HookEntry {
  matcher?: Record<string, unknown>;
  hooks: HookCommand[];
}

// Generate our hook entry for a given hook type
function generateOurHookEntry(hookType: string): HookEntry {
  const settings = getSettings();
  const port = settings.hookServerPort;

  // Use curl with silent mode and error suppression so it doesn't break Claude Code
  const command = `curl -s -X POST http://127.0.0.1:${port}/${hookType} -H 'Content-Type: application/json' -d @- 2>/dev/null || true`;

  return {
    hooks: [{ type: 'command', command, timeout: 5 }],
  };
}

// Check if a hook entry is ours (contains our curl command)
function isOurHookEntry(entry: unknown, port: number): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as Record<string, unknown>;
  if (!Array.isArray(e.hooks)) return false;

  return e.hooks.some((hook: unknown) => {
    if (!hook || typeof hook !== 'object') return false;
    const h = hook as Record<string, unknown>;
    return typeof h.command === 'string' && h.command.includes(`127.0.0.1:${port}`);
  });
}

// Read existing Claude Code settings
export function readClaudeSettings(): Record<string, unknown> | null {
  const settingsPath = getClaudeSettingsPath();

  try {
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    }
  } catch (error) {
    log.error('Error reading Claude settings:', { error });
  }

  return null;
}

// Write Claude Code settings
export function writeClaudeSettings(settings: Record<string, unknown>): boolean {
  const settingsPath = getClaudeSettingsPath();

  try {
    // Ensure directory exists
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write with pretty formatting
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (error) {
    log.error('Error writing Claude settings:', { error });
    return false;
  }
}

// Hook types we install
const HOOK_TYPES = ['PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SessionStart', 'SessionEnd'];

// Install hooks into Claude Code settings
export function installHooks(): { success: boolean; message: string } {
  try {
    // Read existing settings or create empty object
    const claudeSettings = readClaudeSettings() || {};
    const settings = getSettings();
    const port = settings.hookServerPort;

    // Get existing hooks or create empty object
    const existingHooks = (claudeSettings.hooks as Record<string, unknown[]>) || {};
    const newHooks: Record<string, unknown[]> = {};

    // For each hook type, preserve existing entries and add/update ours
    for (const hookType of HOOK_TYPES) {
      const existingEntries = Array.isArray(existingHooks[hookType]) ? existingHooks[hookType] : [];

      // Filter out any existing entries that are ours (we'll add fresh one)
      const otherEntries = existingEntries.filter((entry) => !isOurHookEntry(entry, port));

      // Add our hook entry
      const ourEntry = generateOurHookEntry(hookType);
      newHooks[hookType] = [...otherEntries, ourEntry];
    }

    // Preserve any other hook types that aren't in our list
    for (const [hookType, entries] of Object.entries(existingHooks)) {
      if (!HOOK_TYPES.includes(hookType)) {
        newHooks[hookType] = entries;
      }
    }

    // Update settings
    claudeSettings.hooks = newHooks;

    // Write back
    if (writeClaudeSettings(claudeSettings)) {
      return {
        success: true,
        message: `Hooks installed successfully to ${getClaudeSettingsPath()}`,
      };
    } else {
      return {
        success: false,
        message: 'Failed to write Claude Code settings file',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error installing hooks: ${String(error)}`,
    };
  }
}

// Uninstall hooks from Claude Code settings
export function uninstallHooks(): { success: boolean; message: string } {
  try {
    const claudeSettings = readClaudeSettings();

    if (!claudeSettings) {
      return {
        success: true,
        message: 'No Claude Code settings found',
      };
    }

    const settings = getSettings();
    const port = settings.hookServerPort;
    const existingHooks = (claudeSettings.hooks as Record<string, unknown[]>) || {};
    const newHooks: Record<string, unknown[]> = {};

    // Remove our hooks from each hook type, keeping others
    for (const [hookType, entries] of Object.entries(existingHooks)) {
      if (!Array.isArray(entries)) continue;

      const filteredEntries = entries.filter((entry) => !isOurHookEntry(entry, port));

      if (filteredEntries.length > 0) {
        newHooks[hookType] = filteredEntries;
      }
    }

    // Update settings
    if (Object.keys(newHooks).length > 0) {
      claudeSettings.hooks = newHooks;
    } else {
      delete claudeSettings.hooks;
    }

    // Write back
    if (writeClaudeSettings(claudeSettings)) {
      return {
        success: true,
        message: 'Hooks uninstalled successfully',
      };
    } else {
      return {
        success: false,
        message: 'Failed to write Claude Code settings file',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error uninstalling hooks: ${String(error)}`,
    };
  }
}

// Check if hooks are currently installed
export function areHooksInstalled(): boolean {
  const claudeSettings = readClaudeSettings();

  if (!claudeSettings || !claudeSettings.hooks) {
    return false;
  }

  const hooks = claudeSettings.hooks as Record<string, unknown[]>;
  const settings = getSettings();
  const port = settings.hookServerPort;

  // Check if at least one of our hooks is present
  return Object.values(hooks).some((entries) => {
    if (!Array.isArray(entries)) return false;
    return entries.some((entry) => isOurHookEntry(entry, port));
  });
}

// Get the current hook status
export function getHookStatus(): {
  installed: boolean;
  settingsPath: string;
  settingsExist: boolean;
  hookTypes: string[];
} {
  const settingsPath = getClaudeSettingsPath();
  const settingsExist = fs.existsSync(settingsPath);
  const claudeSettings = readClaudeSettings();
  const installed = areHooksInstalled();

  const hookTypes: string[] = [];
  if (claudeSettings?.hooks) {
    const hooks = claudeSettings.hooks as Record<string, unknown[]>;
    const settings = getSettings();
    const port = settings.hookServerPort;

    for (const [hookType, entries] of Object.entries(hooks)) {
      if (!Array.isArray(entries)) continue;
      if (entries.some((entry) => isOurHookEntry(entry, port))) {
        hookTypes.push(hookType);
      }
    }
  }

  return {
    installed,
    settingsPath,
    settingsExist,
    hookTypes,
  };
}
