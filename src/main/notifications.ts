import { Notification, app } from 'electron';
import * as path from 'path';
import { log } from './logger';
import { showPopover, getPopoverWindow } from './windows';

let iconPath: string;

export function initNotifications(): void {
  // Set up icon path for notifications
  iconPath = path.join(app.getAppPath(), 'assets', 'icon.png');
}

export function showNotification(title: string, body: string): void {
  if (!Notification.isSupported()) {
    log.debug('Notifications not supported on this system');
    return;
  }

  const notification = new Notification({
    title,
    body,
    icon: iconPath,
    silent: false,
    urgency: 'normal',
  });

  notification.on('click', () => {
    log.debug('Notification clicked, showing popover');
    // Show and focus the popover window when notification is clicked
    showPopover();
    const popover = getPopoverWindow();
    if (popover && !popover.isDestroyed()) {
      popover.focus();
    }
  });

  notification.show();
}

export function showErrorNotification(title: string, error: string): void {
  showNotification(`Error: ${title}`, error);
}

export function showSessionEndNotification(workingDirectory: string): void {
  showNotification('Claude Session Complete', `Session in ${workingDirectory} has finished`);
}

export function showWaitingForInputNotification(message: string): void {
  showNotification('Claude Needs Input', message);
}
