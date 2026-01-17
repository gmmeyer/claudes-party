interface AppSettings {
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  userPhoneNumber: string;
  smsNotificationsEnabled: boolean;
  desktopNotificationsEnabled: boolean;
  notifyOnSessionEnd: boolean;
  notifyOnError: boolean;
  notifyOnWaitingForInput: boolean;
  popoverPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  popoverOpacity: number;
  alwaysOnTop: boolean;
  hookServerPort: number;
}

// DOM Elements
const elevenLabsApiKeyEl = document.getElementById('elevenlabs-api-key') as HTMLInputElement;
const elevenLabsVoiceIdEl = document.getElementById('elevenlabs-voice-id') as HTMLInputElement;
const voiceInputEnabledEl = document.getElementById('voice-input-enabled') as HTMLInputElement;
const voiceOutputEnabledEl = document.getElementById('voice-output-enabled') as HTMLInputElement;

const twilioAccountSidEl = document.getElementById('twilio-account-sid') as HTMLInputElement;
const twilioAuthTokenEl = document.getElementById('twilio-auth-token') as HTMLInputElement;
const twilioPhoneNumberEl = document.getElementById('twilio-phone-number') as HTMLInputElement;
const userPhoneNumberEl = document.getElementById('user-phone-number') as HTMLInputElement;
const smsNotificationsEnabledEl = document.getElementById('sms-notifications-enabled') as HTMLInputElement;

const desktopNotificationsEnabledEl = document.getElementById('desktop-notifications-enabled') as HTMLInputElement;
const notifyOnSessionEndEl = document.getElementById('notify-on-session-end') as HTMLInputElement;
const notifyOnErrorEl = document.getElementById('notify-on-error') as HTMLInputElement;
const notifyOnWaitingEl = document.getElementById('notify-on-waiting') as HTMLInputElement;

const popoverPositionEl = document.getElementById('popover-position') as HTMLSelectElement;
const popoverOpacityEl = document.getElementById('popover-opacity') as HTMLInputElement;
const opacityValueEl = document.getElementById('opacity-value') as HTMLSpanElement;
const alwaysOnTopEl = document.getElementById('always-on-top') as HTMLInputElement;

const hookServerPortEl = document.getElementById('hook-server-port') as HTMLInputElement;
const hookConfigEl = document.getElementById('hook-config') as HTMLElement;
const copyHookConfigEl = document.getElementById('copy-hook-config') as HTMLButtonElement;

const saveBtnEl = document.getElementById('save-btn') as HTMLButtonElement;
const resetBtnEl = document.getElementById('reset-btn') as HTMLButtonElement;

const toastEl = document.getElementById('toast') as HTMLDivElement;

// Load settings
async function loadSettings() {
  const settings = await window.electronAPI.getSettings();
  applySettingsToForm(settings);
  updateHookConfig(settings.hookServerPort);
}

function applySettingsToForm(settings: AppSettings) {
  elevenLabsApiKeyEl.value = settings.elevenLabsApiKey;
  elevenLabsVoiceIdEl.value = settings.elevenLabsVoiceId;
  voiceInputEnabledEl.checked = settings.voiceInputEnabled;
  voiceOutputEnabledEl.checked = settings.voiceOutputEnabled;

  twilioAccountSidEl.value = settings.twilioAccountSid;
  twilioAuthTokenEl.value = settings.twilioAuthToken;
  twilioPhoneNumberEl.value = settings.twilioPhoneNumber;
  userPhoneNumberEl.value = settings.userPhoneNumber;
  smsNotificationsEnabledEl.checked = settings.smsNotificationsEnabled;

  desktopNotificationsEnabledEl.checked = settings.desktopNotificationsEnabled;
  notifyOnSessionEndEl.checked = settings.notifyOnSessionEnd;
  notifyOnErrorEl.checked = settings.notifyOnError;
  notifyOnWaitingEl.checked = settings.notifyOnWaitingForInput;

  popoverPositionEl.value = settings.popoverPosition;
  popoverOpacityEl.value = String(settings.popoverOpacity * 100);
  opacityValueEl.textContent = `${Math.round(settings.popoverOpacity * 100)}%`;
  alwaysOnTopEl.checked = settings.alwaysOnTop;

  hookServerPortEl.value = String(settings.hookServerPort);
}

function getFormSettings(): Partial<AppSettings> {
  return {
    elevenLabsApiKey: elevenLabsApiKeyEl.value,
    elevenLabsVoiceId: elevenLabsVoiceIdEl.value,
    voiceInputEnabled: voiceInputEnabledEl.checked,
    voiceOutputEnabled: voiceOutputEnabledEl.checked,

    twilioAccountSid: twilioAccountSidEl.value,
    twilioAuthToken: twilioAuthTokenEl.value,
    twilioPhoneNumber: twilioPhoneNumberEl.value,
    userPhoneNumber: userPhoneNumberEl.value,
    smsNotificationsEnabled: smsNotificationsEnabledEl.checked,

    desktopNotificationsEnabled: desktopNotificationsEnabledEl.checked,
    notifyOnSessionEnd: notifyOnSessionEndEl.checked,
    notifyOnError: notifyOnErrorEl.checked,
    notifyOnWaitingForInput: notifyOnWaitingEl.checked,

    popoverPosition: popoverPositionEl.value as AppSettings['popoverPosition'],
    popoverOpacity: parseInt(popoverOpacityEl.value) / 100,
    alwaysOnTop: alwaysOnTopEl.checked,

    hookServerPort: parseInt(hookServerPortEl.value)
  };
}

function updateHookConfig(port: number) {
  const config = `{
  "hooks": {
    "PreToolUse": ["curl -X POST http://127.0.0.1:${port}/PreToolUse -d @-"],
    "PostToolUse": ["curl -X POST http://127.0.0.1:${port}/PostToolUse -d @-"],
    "Notification": ["curl -X POST http://127.0.0.1:${port}/Notification -d @-"],
    "Stop": ["curl -X POST http://127.0.0.1:${port}/Stop -d @-"]
  }
}`;
  hookConfigEl.textContent = config;
}

function showToast(message: string, isError = false) {
  toastEl.textContent = message;
  toastEl.className = isError ? 'toast error' : 'toast';

  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3000);
}

// Event Listeners
saveBtnEl.addEventListener('click', async () => {
  try {
    const settings = getFormSettings();
    await window.electronAPI.saveSettings(settings);
    showToast('Settings saved successfully');
  } catch (error) {
    showToast('Failed to save settings', true);
    console.error(error);
  }
});

resetBtnEl.addEventListener('click', async () => {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    const defaultSettings: AppSettings = {
      elevenLabsApiKey: '',
      elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
      voiceInputEnabled: false,
      voiceOutputEnabled: false,
      twilioAccountSid: '',
      twilioAuthToken: '',
      twilioPhoneNumber: '',
      userPhoneNumber: '',
      smsNotificationsEnabled: false,
      desktopNotificationsEnabled: true,
      notifyOnSessionEnd: true,
      notifyOnError: true,
      notifyOnWaitingForInput: true,
      popoverPosition: 'top-right',
      popoverOpacity: 0.95,
      alwaysOnTop: true,
      hookServerPort: 31548
    };
    await window.electronAPI.saveSettings(defaultSettings);
    applySettingsToForm(defaultSettings);
    showToast('Settings reset to defaults');
  }
});

popoverOpacityEl.addEventListener('input', () => {
  opacityValueEl.textContent = `${popoverOpacityEl.value}%`;
});

hookServerPortEl.addEventListener('change', () => {
  updateHookConfig(parseInt(hookServerPortEl.value));
});

copyHookConfigEl.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(hookConfigEl.textContent || '');
    showToast('Configuration copied to clipboard');
  } catch (error) {
    showToast('Failed to copy', true);
  }
});

// External links
document.getElementById('elevenlabs-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  // Would use shell.openExternal in real app
  window.electronAPI.showNotification('ElevenLabs', 'Visit elevenlabs.io to get your API key');
});

// Initialize
loadSettings();
