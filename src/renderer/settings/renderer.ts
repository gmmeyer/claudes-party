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
  smsReplyEnabled: boolean;
  twilioWebhookUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  telegramNotificationsEnabled: boolean;
  telegramReplyEnabled: boolean;
  discordWebhookUrl: string;
  discordBotToken: string;
  discordChannelId: string;
  discordNotificationsEnabled: boolean;
  discordReplyEnabled: boolean;
  desktopNotificationsEnabled: boolean;
  notifyOnSessionEnd: boolean;
  notifyOnError: boolean;
  notifyOnWaitingForInput: boolean;
  popoverPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  popoverOpacity: number;
  alwaysOnTop: boolean;
  hookServerPort: number;
}

interface HookStatus {
  installed: boolean;
  settingsPath: string;
  settingsExist: boolean;
  hookTypes: string[];
}

interface CliStatus {
  installed: boolean;
  path: string | null;
  targetPath: string;
  error?: string;
}

interface SetupResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// DOM Elements - Settings
const elevenLabsApiKeyEl = document.getElementById('elevenlabs-api-key') as HTMLInputElement;
const elevenLabsVoiceIdEl = document.getElementById('elevenlabs-voice-id') as HTMLInputElement;
const voiceInputEnabledEl = document.getElementById('voice-input-enabled') as HTMLInputElement;
const voiceOutputEnabledEl = document.getElementById('voice-output-enabled') as HTMLInputElement;

// Twilio
const twilioAccountSidEl = document.getElementById('twilio-account-sid') as HTMLInputElement;
const twilioAuthTokenEl = document.getElementById('twilio-auth-token') as HTMLInputElement;
const twilioPhoneNumberEl = document.getElementById('twilio-phone-number') as HTMLInputElement;
const userPhoneNumberEl = document.getElementById('user-phone-number') as HTMLInputElement;
const twilioWebhookUrlEl = document.getElementById('twilio-webhook-url') as HTMLInputElement;
const smsNotificationsEnabledEl = document.getElementById(
  'sms-notifications-enabled'
) as HTMLInputElement;
const smsReplyEnabledEl = document.getElementById('sms-reply-enabled') as HTMLInputElement;
const setupTwilioBtnEl = document.getElementById('setup-twilio-btn') as HTMLButtonElement;
const twilioStatusEl = document.getElementById('twilio-status') as HTMLDivElement;

// Telegram
const telegramBotTokenEl = document.getElementById('telegram-bot-token') as HTMLInputElement;
const telegramChatIdEl = document.getElementById('telegram-chat-id') as HTMLInputElement;
const telegramNotificationsEnabledEl = document.getElementById(
  'telegram-notifications-enabled'
) as HTMLInputElement;
const telegramReplyEnabledEl = document.getElementById(
  'telegram-reply-enabled'
) as HTMLInputElement;
const setupTelegramBtnEl = document.getElementById('setup-telegram-btn') as HTMLButtonElement;
const testTelegramBtnEl = document.getElementById('test-telegram-btn') as HTMLButtonElement;
const telegramStatusEl = document.getElementById('telegram-status') as HTMLDivElement;

// Discord
const discordWebhookUrlEl = document.getElementById('discord-webhook-url') as HTMLInputElement;
const discordBotTokenEl = document.getElementById('discord-bot-token') as HTMLInputElement;
const discordChannelIdEl = document.getElementById('discord-channel-id') as HTMLInputElement;
const discordNotificationsEnabledEl = document.getElementById(
  'discord-notifications-enabled'
) as HTMLInputElement;
const discordReplyEnabledEl = document.getElementById('discord-reply-enabled') as HTMLInputElement;
const setupDiscordBtnEl = document.getElementById('setup-discord-btn') as HTMLButtonElement;
const testDiscordBtnEl = document.getElementById('test-discord-btn') as HTMLButtonElement;
const discordStatusEl = document.getElementById('discord-status') as HTMLDivElement;

// Desktop notifications
const desktopNotificationsEnabledEl = document.getElementById(
  'desktop-notifications-enabled'
) as HTMLInputElement;
const notifyOnSessionEndEl = document.getElementById('notify-on-session-end') as HTMLInputElement;
const notifyOnErrorEl = document.getElementById('notify-on-error') as HTMLInputElement;
const notifyOnWaitingEl = document.getElementById('notify-on-waiting') as HTMLInputElement;

// Appearance
const popoverPositionEl = document.getElementById('popover-position') as HTMLSelectElement;
const popoverOpacityEl = document.getElementById('popover-opacity') as HTMLInputElement;
const opacityValueEl = document.getElementById('opacity-value') as HTMLSpanElement;
const alwaysOnTopEl = document.getElementById('always-on-top') as HTMLInputElement;

// Hook settings
const hookServerPortEl = document.getElementById('hook-server-port') as HTMLInputElement;
const hookConfigEl = document.getElementById('hook-config') as HTMLElement;
const copyHookConfigEl = document.getElementById('copy-hook-config') as HTMLButtonElement;

// Buttons
const saveBtnEl = document.getElementById('save-btn') as HTMLButtonElement;
const resetBtnEl = document.getElementById('reset-btn') as HTMLButtonElement;

const toastEl = document.getElementById('toast') as HTMLDivElement;

// DOM Elements - Hook Management
const hookStatusDotEl = document.getElementById('hook-status-dot') as HTMLSpanElement;
const hookStatusTextEl = document.getElementById('hook-status-text') as HTMLSpanElement;
const hookStatusDetailsEl = document.getElementById('hook-status-details') as HTMLDivElement;
const installHooksBtnEl = document.getElementById('install-hooks-btn') as HTMLButtonElement;
const uninstallHooksBtnEl = document.getElementById('uninstall-hooks-btn') as HTMLButtonElement;
const refreshStatusBtnEl = document.getElementById('refresh-status-btn') as HTMLButtonElement;

// DOM Elements - CLI Management
const cliStatusDotEl = document.getElementById('cli-status-dot') as HTMLSpanElement;
const cliStatusTextEl = document.getElementById('cli-status-text') as HTMLSpanElement;
const cliStatusDetailsEl = document.getElementById('cli-status-details') as HTMLDivElement;
const installCliBtnEl = document.getElementById('install-cli-btn') as HTMLButtonElement;
const uninstallCliBtnEl = document.getElementById('uninstall-cli-btn') as HTMLButtonElement;
const cliStatusEl = document.getElementById('cli-status') as HTMLDivElement;

// Load settings
async function loadSettings() {
  const settings = await window.electronAPI.getSettings();
  applySettingsToForm(settings);
  updateHookConfig(settings.hookServerPort);
  await refreshHookStatus();
  await refreshCliStatus();
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
  twilioWebhookUrlEl.value = settings.twilioWebhookUrl || '';
  smsNotificationsEnabledEl.checked = settings.smsNotificationsEnabled;
  smsReplyEnabledEl.checked = settings.smsReplyEnabled;

  telegramBotTokenEl.value = settings.telegramBotToken;
  telegramChatIdEl.value = settings.telegramChatId;
  telegramNotificationsEnabledEl.checked = settings.telegramNotificationsEnabled;
  telegramReplyEnabledEl.checked = settings.telegramReplyEnabled;

  discordWebhookUrlEl.value = settings.discordWebhookUrl;
  discordBotTokenEl.value = settings.discordBotToken;
  discordChannelIdEl.value = settings.discordChannelId;
  discordNotificationsEnabledEl.checked = settings.discordNotificationsEnabled;
  discordReplyEnabledEl.checked = settings.discordReplyEnabled;

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
    twilioWebhookUrl: twilioWebhookUrlEl.value,
    smsNotificationsEnabled: smsNotificationsEnabledEl.checked,
    smsReplyEnabled: smsReplyEnabledEl.checked,

    telegramBotToken: telegramBotTokenEl.value,
    telegramChatId: telegramChatIdEl.value,
    telegramNotificationsEnabled: telegramNotificationsEnabledEl.checked,
    telegramReplyEnabled: telegramReplyEnabledEl.checked,

    discordWebhookUrl: discordWebhookUrlEl.value,
    discordBotToken: discordBotTokenEl.value,
    discordChannelId: discordChannelIdEl.value,
    discordNotificationsEnabled: discordNotificationsEnabledEl.checked,
    discordReplyEnabled: discordReplyEnabledEl.checked,

    desktopNotificationsEnabled: desktopNotificationsEnabledEl.checked,
    notifyOnSessionEnd: notifyOnSessionEndEl.checked,
    notifyOnError: notifyOnErrorEl.checked,
    notifyOnWaitingForInput: notifyOnWaitingEl.checked,

    popoverPosition: popoverPositionEl.value as AppSettings['popoverPosition'],
    popoverOpacity: parseInt(popoverOpacityEl.value) / 100,
    alwaysOnTop: alwaysOnTopEl.checked,

    hookServerPort: parseInt(hookServerPortEl.value),
  };
}

function updateHookConfig(port: number) {
  const config = `{
  "hooks": {
    "PreToolUse": ["curl -s -X POST http://127.0.0.1:${port}/PreToolUse -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "PostToolUse": ["curl -s -X POST http://127.0.0.1:${port}/PostToolUse -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "Notification": ["curl -s -X POST http://127.0.0.1:${port}/Notification -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "Stop": ["curl -s -X POST http://127.0.0.1:${port}/Stop -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "SessionStart": ["curl -s -X POST http://127.0.0.1:${port}/SessionStart -H 'Content-Type: application/json' -d @- 2>/dev/null || true"],
    "SessionEnd": ["curl -s -X POST http://127.0.0.1:${port}/SessionEnd -H 'Content-Type: application/json' -d @- 2>/dev/null || true"]
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

function showStatusMessage(element: HTMLDivElement, message: string, isError = false) {
  element.textContent = message;
  element.className = isError ? 'status-message error' : 'status-message success';
  setTimeout(() => {
    element.classList.add('hidden');
  }, 5000);
}

// Hook Status Management
async function refreshHookStatus() {
  // Set to checking state
  hookStatusDotEl.className = 'status-dot checking';
  hookStatusTextEl.textContent = 'Checking hook status...';
  hookStatusDetailsEl.textContent = '';

  try {
    const status: HookStatus = await window.electronAPI.getHookStatus();

    if (status.installed) {
      hookStatusDotEl.className = 'status-dot installed';
      hookStatusTextEl.textContent = 'Hooks installed';
      hookStatusDetailsEl.innerHTML = `
        <div>Active hooks: ${status.hookTypes.join(', ')}</div>
        <div style="margin-top: 4px; font-size: 11px; color: #666;">Settings: ${status.settingsPath}</div>
      `;
      installHooksBtnEl.textContent = 'Reinstall Hooks';
    } else {
      hookStatusDotEl.className = 'status-dot not-installed';
      hookStatusTextEl.textContent = 'Hooks not installed';
      hookStatusDetailsEl.innerHTML = status.settingsExist
        ? `<div>Claude Code settings found but hooks not configured</div>`
        : `<div>Claude Code settings file will be created</div>`;
      installHooksBtnEl.textContent = 'Install Hooks';
    }
  } catch (error) {
    hookStatusDotEl.className = 'status-dot not-installed';
    hookStatusTextEl.textContent = 'Error checking status';
    hookStatusDetailsEl.textContent = String(error);
  }
}

async function installHooks() {
  installHooksBtnEl.disabled = true;
  installHooksBtnEl.textContent = 'Installing...';

  try {
    const result = await window.electronAPI.installHooks();

    if (result.success) {
      showToast('Hooks installed successfully!');
      await refreshHookStatus();
    } else {
      showToast(result.message, true);
    }
  } catch (error) {
    showToast('Failed to install hooks: ' + String(error), true);
  } finally {
    installHooksBtnEl.disabled = false;
  }
}

async function uninstallHooks() {
  if (
    !confirm(
      'Are you sure you want to uninstall the hooks? Claude Code will no longer send events to this app.'
    )
  ) {
    return;
  }

  uninstallHooksBtnEl.disabled = true;
  uninstallHooksBtnEl.textContent = 'Uninstalling...';

  try {
    const result = await window.electronAPI.uninstallHooks();

    if (result.success) {
      showToast('Hooks uninstalled successfully');
      await refreshHookStatus();
    } else {
      showToast(result.message, true);
    }
  } catch (error) {
    showToast('Failed to uninstall hooks: ' + String(error), true);
  } finally {
    uninstallHooksBtnEl.disabled = false;
    uninstallHooksBtnEl.textContent = 'Uninstall Hooks';
  }
}

// CLI Status Management
async function refreshCliStatus() {
  // Set to checking state
  cliStatusDotEl.className = 'status-dot checking';
  cliStatusTextEl.textContent = 'Checking CLI status...';
  cliStatusDetailsEl.textContent = '';

  try {
    const status: CliStatus = await window.electronAPI.getCliStatus();

    if (status.installed) {
      cliStatusDotEl.className = 'status-dot installed';
      cliStatusTextEl.textContent = 'CLI installed';
      cliStatusDetailsEl.innerHTML = `
        <div>Installed at: <code>${status.path}</code></div>
        <div style="margin-top: 4px; font-size: 11px; color: #666;">Run <code>claude-party</code> in your terminal</div>
      `;
      installCliBtnEl.textContent = 'Reinstall CLI';
    } else {
      cliStatusDotEl.className = 'status-dot not-installed';
      cliStatusTextEl.textContent = 'CLI not installed';
      if (status.error) {
        cliStatusDetailsEl.innerHTML = `<div style="color: #e74c3c;">${status.error}</div>`;
      } else {
        cliStatusDetailsEl.innerHTML = `<div>Click "Install CLI" to add <code>claude-party</code> to your PATH</div>`;
      }
      installCliBtnEl.textContent = 'Install CLI';
    }
  } catch (error) {
    cliStatusDotEl.className = 'status-dot not-installed';
    cliStatusTextEl.textContent = 'Error checking status';
    cliStatusDetailsEl.textContent = String(error);
  }
}

async function installCli() {
  installCliBtnEl.disabled = true;
  installCliBtnEl.textContent = 'Installing...';

  try {
    const result = await window.electronAPI.installCli();

    if (result.success) {
      showToast('CLI installed successfully!');
      showStatusMessage(cliStatusEl, result.message);
      await refreshCliStatus();
    } else {
      showToast(result.message, true);
      showStatusMessage(cliStatusEl, result.message, true);
    }
  } catch (error) {
    showToast('Failed to install CLI: ' + String(error), true);
  } finally {
    installCliBtnEl.disabled = false;
  }
}

async function uninstallCli() {
  if (!confirm('Are you sure you want to uninstall the claude-party CLI?')) {
    return;
  }

  uninstallCliBtnEl.disabled = true;
  uninstallCliBtnEl.textContent = 'Uninstalling...';

  try {
    const result = await window.electronAPI.uninstallCli();

    if (result.success) {
      showToast('CLI uninstalled successfully');
      await refreshCliStatus();
    } else {
      showToast(result.message, true);
    }
  } catch (error) {
    showToast('Failed to uninstall CLI: ' + String(error), true);
  } finally {
    uninstallCliBtnEl.disabled = false;
    uninstallCliBtnEl.textContent = 'Uninstall CLI';
  }
}

// Twilio Setup
async function setupTwilio() {
  // First save current settings
  await window.electronAPI.saveSettings({
    twilioAccountSid: twilioAccountSidEl.value,
    twilioAuthToken: twilioAuthTokenEl.value,
  });

  setupTwilioBtnEl.disabled = true;
  setupTwilioBtnEl.textContent = 'Setting up...';

  try {
    const result: SetupResult = await window.electronAPI.setupTwilio(twilioWebhookUrlEl.value);

    if (result.success) {
      showStatusMessage(twilioStatusEl, result.message);
      // Reload settings to get the new phone number
      const settings = await window.electronAPI.getSettings();
      twilioPhoneNumberEl.value = settings.twilioPhoneNumber;
    } else {
      showStatusMessage(twilioStatusEl, result.message, true);
    }
  } catch (error) {
    showStatusMessage(twilioStatusEl, 'Setup failed: ' + String(error), true);
  } finally {
    setupTwilioBtnEl.disabled = false;
    setupTwilioBtnEl.textContent = 'Auto Setup';
  }
}

// Telegram Setup
async function setupTelegram() {
  // First save current settings
  await window.electronAPI.saveSettings({
    telegramBotToken: telegramBotTokenEl.value,
  });

  setupTelegramBtnEl.disabled = true;
  setupTelegramBtnEl.textContent = 'Setting up...';

  try {
    const result: SetupResult = await window.electronAPI.setupTelegram();

    if (result.success) {
      showStatusMessage(telegramStatusEl, result.message);
      // Reload settings to get the chat ID if auto-detected
      const settings = await window.electronAPI.getSettings();
      if (settings.telegramChatId) {
        telegramChatIdEl.value = settings.telegramChatId;
      }
    } else {
      showStatusMessage(telegramStatusEl, result.message, true);
    }
  } catch (error) {
    showStatusMessage(telegramStatusEl, 'Setup failed: ' + String(error), true);
  } finally {
    setupTelegramBtnEl.disabled = false;
    setupTelegramBtnEl.textContent = 'Setup';
  }
}

async function testTelegram() {
  testTelegramBtnEl.disabled = true;
  testTelegramBtnEl.textContent = 'Testing...';

  try {
    const result: SetupResult = await window.electronAPI.testTelegram();

    if (result.success) {
      showStatusMessage(telegramStatusEl, result.message);
    } else {
      showStatusMessage(telegramStatusEl, result.message, true);
    }
  } catch (error) {
    showStatusMessage(telegramStatusEl, 'Test failed: ' + String(error), true);
  } finally {
    testTelegramBtnEl.disabled = false;
    testTelegramBtnEl.textContent = 'Test Telegram';
  }
}

// Discord Setup
async function setupDiscord() {
  // First save current settings
  await window.electronAPI.saveSettings({
    discordWebhookUrl: discordWebhookUrlEl.value,
    discordBotToken: discordBotTokenEl.value,
    discordChannelId: discordChannelIdEl.value,
  });

  setupDiscordBtnEl.disabled = true;
  setupDiscordBtnEl.textContent = 'Setting up...';

  try {
    const result: SetupResult = await window.electronAPI.setupDiscord();

    if (result.success) {
      showStatusMessage(discordStatusEl, result.message);
    } else {
      showStatusMessage(discordStatusEl, result.message, true);
    }
  } catch (error) {
    showStatusMessage(discordStatusEl, 'Setup failed: ' + String(error), true);
  } finally {
    setupDiscordBtnEl.disabled = false;
    setupDiscordBtnEl.textContent = 'Setup Discord';
  }
}

async function testDiscord() {
  testDiscordBtnEl.disabled = true;
  testDiscordBtnEl.textContent = 'Testing...';

  try {
    const result: SetupResult = await window.electronAPI.testDiscord();

    if (result.success) {
      showStatusMessage(discordStatusEl, result.message);
    } else {
      showStatusMessage(discordStatusEl, result.message, true);
    }
  } catch (error) {
    showStatusMessage(discordStatusEl, 'Test failed: ' + String(error), true);
  } finally {
    testDiscordBtnEl.disabled = false;
    testDiscordBtnEl.textContent = 'Test Discord';
  }
}

// Event Listeners - Settings
saveBtnEl.addEventListener('click', () => {
  void (async () => {
    try {
      const settings = getFormSettings();
      await window.electronAPI.saveSettings(settings);
      showToast('Settings saved successfully');
    } catch (error) {
      showToast('Failed to save settings', true);
      console.error(error);
    }
  })();
});

resetBtnEl.addEventListener('click', () => {
  void (async () => {
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
        twilioWebhookUrl: '',
        smsNotificationsEnabled: false,
        smsReplyEnabled: true,
        telegramBotToken: '',
        telegramChatId: '',
        telegramNotificationsEnabled: false,
        telegramReplyEnabled: true,
        discordWebhookUrl: '',
        discordBotToken: '',
        discordChannelId: '',
        discordNotificationsEnabled: false,
        discordReplyEnabled: true,
        desktopNotificationsEnabled: true,
        notifyOnSessionEnd: true,
        notifyOnError: true,
        notifyOnWaitingForInput: true,
        popoverPosition: 'top-right',
        popoverOpacity: 0.95,
        alwaysOnTop: true,
        hookServerPort: 31548,
      };
      await window.electronAPI.saveSettings(defaultSettings);
      applySettingsToForm(defaultSettings);
      showToast('Settings reset to defaults');
    }
  })();
});

popoverOpacityEl.addEventListener('input', () => {
  opacityValueEl.textContent = `${popoverOpacityEl.value}%`;
});

hookServerPortEl.addEventListener('change', () => {
  updateHookConfig(parseInt(hookServerPortEl.value));
});

copyHookConfigEl.addEventListener('click', () => {
  void (async () => {
    try {
      await navigator.clipboard.writeText(hookConfigEl.textContent || '');
      showToast('Configuration copied to clipboard');
    } catch (error) {
      showToast('Failed to copy', true);
    }
  })();
});

// Event Listeners - Hook Management
installHooksBtnEl.addEventListener('click', () => void installHooks());
uninstallHooksBtnEl.addEventListener('click', () => void uninstallHooks());
refreshStatusBtnEl.addEventListener('click', () => void refreshHookStatus());

// Event Listeners - CLI Management
installCliBtnEl.addEventListener('click', () => void installCli());
uninstallCliBtnEl.addEventListener('click', () => void uninstallCli());

// Event Listeners - Twilio
setupTwilioBtnEl.addEventListener('click', () => void setupTwilio());

// Event Listeners - Telegram
setupTelegramBtnEl.addEventListener('click', () => void setupTelegram());
testTelegramBtnEl.addEventListener('click', () => void testTelegram());

// Event Listeners - Discord
setupDiscordBtnEl.addEventListener('click', () => void setupDiscord());
testDiscordBtnEl.addEventListener('click', () => void testDiscord());

// External links
document.getElementById('elevenlabs-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  window.electronAPI.showNotification('ElevenLabs', 'Visit elevenlabs.io to get your API key');
});

// Initialize
void loadSettings();
