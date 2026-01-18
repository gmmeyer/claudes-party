/**
 * CLI Installer
 *
 * Handles installation/uninstallation of the claude-party CLI wrapper
 * by creating/removing symlinks in the system PATH.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { exec } from 'child_process';
import { CliStatus } from '../shared/types';

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

// Where we want to install the symlink
function getInstallPath(): string {
  if (process.platform === 'win32') {
    // Windows: Add to user's local bin folder
    return path.join(
      os.homedir(),
      'AppData',
      'Local',
      'Programs',
      'claude-party',
      'claude-party.cmd'
    );
  } else {
    // macOS/Linux: /usr/local/bin
    return '/usr/local/bin/claude-party';
  }
}

// Check if CLI is installed
export function getCliStatus(): CliStatus {
  const installPath = getInstallPath();
  const sourcePath = getCliSourcePath();

  try {
    if (fs.existsSync(installPath)) {
      // Check if it's a symlink pointing to our CLI
      const stats = fs.lstatSync(installPath);
      if (stats.isSymbolicLink()) {
        const target = fs.readlinkSync(installPath);
        // Check if it points to our app
        if (
          target === sourcePath ||
          target.includes('claude-party') ||
          target.includes('claudes-party')
        ) {
          return { installed: true, path: installPath, targetPath: sourcePath };
        }
      }
      // File exists but isn't our symlink
      return {
        installed: false,
        path: null,
        targetPath: sourcePath,
        error: `${installPath} exists but is not the claude-party CLI`,
      };
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

// Install CLI (create symlink)
export async function installCli(): Promise<{ success: boolean; message: string }> {
  const installPath = getInstallPath();
  const sourcePath = getCliSourcePath();

  try {
    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      // In development, the CLI might not be built yet
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

    // Ensure parent directory exists (for Windows)
    const parentDir = path.dirname(installPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Remove existing symlink if present
    if (fs.existsSync(installPath)) {
      fs.unlinkSync(installPath);
    }

    if (process.platform === 'win32') {
      // Windows: Create a cmd wrapper script
      const wrapperContent = `@echo off\nnode "${sourcePath}" %*`;
      fs.writeFileSync(installPath, wrapperContent);

      // Add to PATH via PowerShell (user PATH)
      return new Promise((resolve) => {
        exec(
          `powershell -Command "[Environment]::SetEnvironmentVariable('PATH', [Environment]::GetEnvironmentVariable('PATH', 'User') + ';${parentDir}', 'User')"`,
          (error) => {
            if (error) {
              resolve({
                success: true,
                message: `CLI installed at ${installPath}. You may need to add ${parentDir} to your PATH manually.`,
              });
            } else {
              resolve({
                success: true,
                message: `CLI installed at ${installPath} and added to PATH. Restart your terminal to use 'claude-party'.`,
              });
            }
          }
        );
      });
    } else {
      // macOS/Linux: Create symlink
      // May need sudo for /usr/local/bin
      return new Promise((resolve) => {
        // First try without sudo
        try {
          // For development, create a wrapper script instead of symlink
          if (!app.isPackaged) {
            const wrapperContent = `#!/bin/bash\nnode "${sourcePath}" "$@"`;
            fs.writeFileSync(installPath, wrapperContent);
            fs.chmodSync(installPath, '755');
          } else {
            fs.symlinkSync(sourcePath, installPath);
          }
          resolve({
            success: true,
            message: `CLI installed at ${installPath}. You can now use 'claude-party' in your terminal.`,
          });
        } catch (error) {
          // Need elevated permissions - use osascript on macOS
          if (process.platform === 'darwin') {
            const script = app.isPackaged
              ? `ln -sf "${sourcePath}" "${installPath}"`
              : `echo '#!/bin/bash\\nnode "${sourcePath}" "$@"' > "${installPath}" && chmod 755 "${installPath}"`;

            exec(
              `osascript -e 'do shell script "${script}" with administrator privileges'`,
              (execError) => {
                if (execError) {
                  resolve({
                    success: false,
                    message: `Failed to install: ${execError.message}. Try running: sudo ln -s "${sourcePath}" "${installPath}"`,
                  });
                } else {
                  resolve({
                    success: true,
                    message: `CLI installed at ${installPath}. You can now use 'claude-party' in your terminal.`,
                  });
                }
              }
            );
          } else {
            // Linux - provide manual instructions
            resolve({
              success: false,
              message: `Permission denied. Run: sudo ln -s "${sourcePath}" "${installPath}"`,
            });
          }
        }
      });
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

// Uninstall CLI (remove symlink)
export async function uninstallCli(): Promise<{ success: boolean; message: string }> {
  const installPath = getInstallPath();

  try {
    if (!fs.existsSync(installPath)) {
      return { success: true, message: 'CLI was not installed.' };
    }

    return new Promise((resolve) => {
      try {
        fs.unlinkSync(installPath);
        resolve({ success: true, message: 'CLI uninstalled successfully.' });
      } catch (error) {
        // Need elevated permissions
        if (process.platform === 'darwin') {
          exec(
            `osascript -e 'do shell script "rm -f ${installPath}" with administrator privileges'`,
            (execError) => {
              if (execError) {
                resolve({
                  success: false,
                  message: `Failed to uninstall: ${execError.message}. Try running: sudo rm "${installPath}"`,
                });
              } else {
                resolve({ success: true, message: 'CLI uninstalled successfully.' });
              }
            }
          );
        } else if (process.platform === 'win32') {
          // Windows shouldn't need elevation for user directory
          resolve({
            success: false,
            message: `Failed to uninstall: ${error instanceof Error ? error.message : String(error)}`,
          });
        } else {
          resolve({
            success: false,
            message: `Permission denied. Run: sudo rm "${installPath}"`,
          });
        }
      }
    });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
