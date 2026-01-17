import { Tray, Menu, nativeImage, app } from 'electron';
import * as path from 'path';
import { togglePopover, createSettingsWindow } from './windows';

let tray: Tray | null = null;

export function createTray(): Tray {
  // Create tray icon - use a simple icon
  const iconPath = path.join(app.getAppPath(), 'assets', 'tray-icon.png');

  // Create a simple icon if the file doesn't exist
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    // Resize for tray
    icon = icon.resize({ width: 16, height: 16 });
  } catch (e) {
    // Create a simple colored icon as fallback
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("Claude's Party - Claude Status Monitor");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide Status',
      click: () => togglePopover()
    },
    {
      label: 'Settings',
      click: () => createSettingsWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Click on tray toggles popover
  tray.on('click', () => {
    togglePopover();
  });

  return tray;
}

export function getTray(): Tray | null {
  return tray;
}

export function updateTrayIcon(hasActiveSessions: boolean): void {
  if (!tray) return;

  // Could change icon color based on active sessions
  const tooltip = hasActiveSessions
    ? "Claude's Party - Sessions Active"
    : "Claude's Party - No Active Sessions";

  tray.setToolTip(tooltip);
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
