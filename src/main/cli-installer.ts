/**
 * CLI Installer
 *
 * Handles installation/uninstallation of the claude-party CLI wrapper
 * by installing to ~/.claude/bin and adding to shell profiles.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { CliStatus } from '../shared/types';
import { log } from './logger';

// Where the CLI binary lives in the bundled app
function getCliSourcePath(): string {
  if (app.isPackaged) {
    // In production, it's in the resources folder
    return path.join(process.resourcesPath, 'cli', 'claude-party');
  } else {
    // In development, use the dist folder
    return path.join(app.getAppPath(), 'dist', 'cli', 'index.js');
  }
}

// Where we install the CLI - ~/.claude/bin
function getInstallDir(): string {
  return path.join(os.homedir(), '.claude', 'bin');
}

function getInstallPath(): string {
  return path.join(getInstallDir(), 'claude-party');
}

// Shell profile paths
function getShellProfiles(): string[] {
  const home = os.homedir();
  return [
    path.join(home, '.zshrc'),
    path.join(home, '.bashrc'),
  ];
}

// The line we add to shell profiles
function getPathExportLine(): string {
  return `export PATH="$HOME/.claude/bin:$PATH"`;
}

// Check if the PATH export is already in a file
function hasPathExport(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.includes('.claude/bin');
    }
  } catch (error) {
    log.warn('Error checking shell profile', { filePath, error });
  }
  return false;
}

// Add PATH export to a shell profile
function addPathExport(filePath: string): boolean {
  try {
    const exportLine = getPathExportLine();

    // Create file if it doesn't exist
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `# Added by Claude's Party\n${exportLine}\n`, 'utf-8');
      return true;
    }

    // Check if already present
    if (hasPathExport(filePath)) {
      return true;
    }

    // Append to file
    const content = fs.readFileSync(filePath, 'utf-8');
    const newContent = content.endsWith('\n')
      ? `${content}\n# Added by Claude's Party\n${exportLine}\n`
      : `${content}\n\n# Added by Claude's Party\n${exportLine}\n`;
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return true;
  } catch (error) {
    log.error('Error adding PATH export', { filePath, error });
    return false;
  }
}

// Remove PATH export from a shell profile
function removePathExport(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return true;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.includes('.claude/bin')) {
      return true;
    }

    // Remove the export line and comment
    const lines = content.split('\n');
    const filteredLines = lines.filter((line, index) => {
      // Remove the export line
      if (line.includes('.claude/bin') && line.includes('export PATH')) {
        return false;
      }
      // Remove the comment line if the next line is the export
      if (line.includes("Added by Claude's Party") &&
          index + 1 < lines.length &&
          lines[index + 1].includes('.claude/bin')) {
        return false;
      }
      return true;
    });

    fs.writeFileSync(filePath, filteredLines.join('\n'), 'utf-8');
    return true;
  } catch (error) {
    log.error('Error removing PATH export', { filePath, error });
    return false;
  }
}

// Check if CLI is installed
export function getCliStatus(): CliStatus {
  const installPath = getInstallPath();
  const sourcePath = getCliSourcePath();

  try {
    if (fs.existsSync(installPath)) {
      return { installed: true, path: installPath, targetPath: sourcePath };
    }
    return { installed: false, path: null, targetPath: sourcePath };
  } catch (error) {
    return {
      installed: false,
      path: null,
      targetPath: sourcePath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Install CLI
export async function installCli(): Promise<{ success: boolean; message: string }> {
  const installDir = getInstallDir();
  const installPath = getInstallPath();
  const sourcePath = getCliSourcePath();

  try {
    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      if (!app.isPackaged) {
        return {
          success: false,
          message: `CLI source not found at ${sourcePath}. Run 'npm run build' first.`,
        };
      }
      return {
        success: false,
        message: `CLI binary not found at ${sourcePath}`,
      };
    }

    // Create install directory
    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true });
    }

    // Remove existing file if present
    if (fs.existsSync(installPath)) {
      fs.unlinkSync(installPath);
    }

    // Create wrapper script
    const wrapperContent = app.isPackaged
      ? `#!/bin/bash\n"${sourcePath}" "$@"`
      : `#!/bin/bash\nnode "${sourcePath}" "$@"`;

    fs.writeFileSync(installPath, wrapperContent, { mode: 0o755 });

    // Add to shell profiles
    const profiles = getShellProfiles();
    const addedTo: string[] = [];

    for (const profile of profiles) {
      if (addPathExport(profile)) {
        if (fs.existsSync(profile)) {
          addedTo.push(path.basename(profile));
        }
      }
    }

    const profilesMsg = addedTo.length > 0
      ? `Added to ${addedTo.join(' and ')}.`
      : '';

    return {
      success: true,
      message: `CLI installed at ${installPath}. ${profilesMsg} Restart your terminal or run 'source ~/.zshrc' to use 'claude-party'.`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

// Uninstall CLI
export async function uninstallCli(): Promise<{ success: boolean; message: string }> {
  const installPath = getInstallPath();

  try {
    // Remove CLI script
    if (fs.existsSync(installPath)) {
      fs.unlinkSync(installPath);
    }

    // Remove from shell profiles
    const profiles = getShellProfiles();
    for (const profile of profiles) {
      removePathExport(profile);
    }

    return { success: true, message: 'CLI uninstalled successfully.' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
