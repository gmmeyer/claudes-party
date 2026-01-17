import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { getSettings } from './store';

let popoverWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

export function createPopoverWindow(): BrowserWindow {
  const settings = getSettings();
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  // Calculate position based on settings
  const windowWidth = 350;
  const windowHeight = 500;
  const margin = 20;

  let x: number, y: number;
  switch (settings.popoverPosition) {
    case 'top-left':
      x = margin;
      y = margin;
      break;
    case 'bottom-left':
      x = margin;
      y = screenHeight - windowHeight - margin;
      break;
    case 'bottom-right':
      x = screenWidth - windowWidth - margin;
      y = screenHeight - windowHeight - margin;
      break;
    case 'top-right':
    default:
      x = screenWidth - windowWidth - margin;
      y = margin;
      break;
  }

  popoverWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  popoverWindow.setOpacity(settings.popoverOpacity);

  // Load the popover HTML
  void popoverWindow.loadFile(path.join(__dirname, '..', 'renderer', 'popover', 'index.html'));

  popoverWindow.once('ready-to-show', () => {
    popoverWindow?.show();
  });

  popoverWindow.on('closed', () => {
    popoverWindow = null;
  });

  return popoverWindow;
}

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 700,
    x: Math.floor((screenWidth - 600) / 2),
    y: Math.floor((screenHeight - 700) / 2),
    frame: true,
    resizable: true,
    minimizable: true,
    maximizable: false,
    title: "Claude's Party - Settings",
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'index.html'));

  // Remove menu bar on Windows/Linux
  settingsWindow.setMenuBarVisibility(false);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

export function getPopoverWindow(): BrowserWindow | null {
  return popoverWindow;
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}

export function togglePopover(): void {
  if (popoverWindow) {
    if (popoverWindow.isVisible()) {
      popoverWindow.hide();
    } else {
      popoverWindow.show();
    }
  } else {
    createPopoverWindow();
  }
}

export function closePopover(): void {
  if (popoverWindow && !popoverWindow.isDestroyed()) {
    popoverWindow.hide();
  }
}

export function showPopover(): void {
  if (popoverWindow && !popoverWindow.isDestroyed()) {
    popoverWindow.show();
  }
}

export function closeSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
}

export function updatePopoverSettings(): void {
  if (!popoverWindow || popoverWindow.isDestroyed()) return;

  const settings = getSettings();
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const windowWidth = 350;
  const windowHeight = 500;
  const margin = 20;

  let x: number, y: number;
  switch (settings.popoverPosition) {
    case 'top-left':
      x = margin;
      y = margin;
      break;
    case 'bottom-left':
      x = margin;
      y = screenHeight - windowHeight - margin;
      break;
    case 'bottom-right':
      x = screenWidth - windowWidth - margin;
      y = screenHeight - windowHeight - margin;
      break;
    case 'top-right':
    default:
      x = screenWidth - windowWidth - margin;
      y = margin;
      break;
  }

  popoverWindow.setPosition(x, y);
  popoverWindow.setOpacity(settings.popoverOpacity);
  popoverWindow.setAlwaysOnTop(settings.alwaysOnTop);
}
