import Store from 'electron-store';
import { AppSettings, DEFAULT_SETTINGS } from '../shared/types';

// Initialize the store with default settings
const store = new Store<{ settings: AppSettings }>({
  defaults: {
    settings: DEFAULT_SETTINGS,
  },
  encryptionKey: 'claudes-party-encryption-key', // Basic encryption for sensitive data
  name: 'claudes-party-config',
});

export function getSettings(): AppSettings {
  return store.get('settings', DEFAULT_SETTINGS);
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const currentSettings = getSettings();
  const newSettings = { ...currentSettings, ...settings };
  store.set('settings', newSettings);
  return newSettings;
}

export function resetSettings(): AppSettings {
  store.set('settings', DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export { store };
