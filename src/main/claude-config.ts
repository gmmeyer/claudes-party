import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getSettings } from './store';

// Get Claude Code settings file path based on platform
export function getClaudeSettingsPath(): string {
  const platform = process.platform;
  const home = os.homedir();

  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Claude', 'settings.json');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'settings.json');
  } else {
    // Linux and others
    return path.join(home, '.config', 'claude', 'settings.json');
  }
}

// Generate hook commands for the current port
export function generateHookCommands(): Record<string, string[]> {
  const settings = getSettings();
  const port = settings.hookServerPort;

  // Use curl with silent mode and error suppression so it doesn't break Claude Code
  const curlCmd = (hookType: string) =>
    `curl -s -X POST http://127.0.0.1:${port}/${hookType} -H 'Content-Type: application/json' -d @- 2>/dev/null || true`;

  return {
    PreToolUse: [curlCmd('PreToolUse')],
    PostToolUse: [curlCmd('PostToolUse')],
    Notification: [curlCmd('Notification')],
    Stop: [curlCmd('Stop')],
    SessionStart: [curlCmd('SessionStart')],
    SessionEnd: [curlCmd('SessionEnd')]
  };
}

// Read existing Claude Code settings
export function readClaudeSettings(): Record<string, unknown> | null {
  const settingsPath = getClaudeSettingsPath();

  try {
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error reading Claude settings:', error);
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
    console.error('Error writing Claude settings:', error);
    return false;
  }
}

// Install hooks into Claude Code settings
export function installHooks(): { success: boolean; message: string } {
  try {
    // Read existing settings or create empty object
    let claudeSettings = readClaudeSettings() || {};

    // Generate new hook commands
    const hookCommands = generateHookCommands();

    // Merge with existing hooks (our hooks will be added, not replace all)
    const existingHooks = (claudeSettings.hooks as Record<string, string[]>) || {};

    // For each hook type, add our command if not already present
    const newHooks: Record<string, string[]> = { ...existingHooks };

    for (const [hookType, commands] of Object.entries(hookCommands)) {
      const existingCommands = existingHooks[hookType] || [];
      const ourCommand = commands[0];

      // Check if our command (or similar) is already in the list
      const alreadyInstalled = existingCommands.some(cmd =>
        cmd.includes('127.0.0.1:') && cmd.includes('/claudes-party') ||
        cmd.includes(`/${hookType}`) && cmd.includes('127.0.0.1:')
      );

      if (alreadyInstalled) {
        // Replace existing Claude's Party hook with updated one
        newHooks[hookType] = existingCommands.map(cmd =>
          (cmd.includes('127.0.0.1:') && cmd.includes(`/${hookType}`))
            ? ourCommand
            : cmd
        );
      } else {
        // Add our command to the list
        newHooks[hookType] = [...existingCommands, ourCommand];
      }
    }

    // Update settings
    claudeSettings.hooks = newHooks;

    // Write back
    if (writeClaudeSettings(claudeSettings)) {
      return {
        success: true,
        message: `Hooks installed successfully to ${getClaudeSettingsPath()}`
      };
    } else {
      return {
        success: false,
        message: 'Failed to write Claude Code settings file'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error installing hooks: ${error}`
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
        message: 'No Claude Code settings found'
      };
    }

    const existingHooks = (claudeSettings.hooks as Record<string, string[]>) || {};
    const newHooks: Record<string, string[]> = {};

    // Remove our hooks from each hook type
    for (const [hookType, commands] of Object.entries(existingHooks)) {
      const filteredCommands = commands.filter(cmd =>
        !(cmd.includes('127.0.0.1:') && cmd.includes(`/${hookType}`))
      );

      if (filteredCommands.length > 0) {
        newHooks[hookType] = filteredCommands;
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
        message: 'Hooks uninstalled successfully'
      };
    } else {
      return {
        success: false,
        message: 'Failed to write Claude Code settings file'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error uninstalling hooks: ${error}`
    };
  }
}

// Check if hooks are currently installed
export function areHooksInstalled(): boolean {
  const claudeSettings = readClaudeSettings();

  if (!claudeSettings || !claudeSettings.hooks) {
    return false;
  }

  const hooks = claudeSettings.hooks as Record<string, string[]>;
  const settings = getSettings();
  const port = settings.hookServerPort;

  // Check if at least one of our hooks is present
  return Object.values(hooks).some(commands =>
    commands.some(cmd => cmd.includes(`127.0.0.1:${port}`))
  );
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
    const hooks = claudeSettings.hooks as Record<string, string[]>;
    const settings = getSettings();
    const port = settings.hookServerPort;

    for (const [hookType, commands] of Object.entries(hooks)) {
      if (commands.some(cmd => cmd.includes(`127.0.0.1:${port}`))) {
        hookTypes.push(hookType);
      }
    }
  }

  return {
    installed,
    settingsPath,
    settingsExist,
    hookTypes
  };
}
