// Option for AskUserQuestion prompts
interface InputOption {
  label: string;
  value: string;
  description?: string;
}

// Claude session interface
interface ClaudeSession {
  id: string;
  workingDirectory: string;
  startTime: number;
  status: 'active' | 'waiting' | 'stopped';
  lastActivity: number;
  currentTool?: string;
  lastNotification?: string;
  slug?: string; // Human-readable session name from Claude (e.g., "lexical-riding-yeti")
  // Fields for AskUserQuestion prompts
  question?: string;
  options?: InputOption[];
}

// DOM Elements
const noSessionsEl = document.getElementById('no-sessions') as HTMLDivElement;
const sessionsListEl = document.getElementById('sessions-list') as HTMLDivElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const minimizeBtn = document.getElementById('minimize-btn') as HTMLButtonElement;
const inputModal = document.getElementById('input-modal') as HTMLDivElement;
const inputSessionInfo = document.getElementById('input-session-info') as HTMLParagraphElement;
const inputText = document.getElementById('input-text') as HTMLTextAreaElement;
const inputCancel = document.getElementById('input-cancel') as HTMLButtonElement;
const inputSend = document.getElementById('input-send') as HTMLButtonElement;
const voiceControls = document.getElementById('voice-controls') as HTMLDivElement;
const voiceBtn = document.getElementById('voice-btn') as HTMLButtonElement;
const voiceStatus = document.getElementById('voice-status') as HTMLSpanElement;
const serverStatusDot = document.getElementById('server-status-dot') as HTMLSpanElement;
const serverStatusText = document.getElementById('server-status-text') as HTMLSpanElement;

let currentInputSessionId: string | null = null;
let isRecording = false;
let recordingSessionId: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recognition: any = null;

// Update server status display
function updateServerStatus(port: number, isConnected: boolean = true) {
  if (isConnected) {
    serverStatusDot.className = 'status-dot connected';
    serverStatusText.textContent = `Hook server on port ${port}`;
  } else {
    serverStatusDot.className = 'status-dot disconnected';
    serverStatusText.textContent = 'Hook server offline';
  }
}

// Update voice status display
function updateVoiceStatus(text: string) {
  if (voiceStatus) {
    voiceStatus.textContent = text;
  }
}

// Initialize
async function init() {
  try {
    // Load initial sessions
    const sessions = await window.electronAPI.getSessions();
    renderSessions(sessions);

  // Listen for session updates
  window.electronAPI.onSessionsUpdated((sessions) => {
    renderSessions(sessions);
  });

  // Get settings and update UI
  const settings = await window.electronAPI.getSettings();

  // Update server status display
  updateServerStatus(settings.hookServerPort);

  // Check if voice input is available
  if (settings.voiceInputEnabled && 'webkitSpeechRecognition' in window) {
    voiceControls.style.display = 'flex';
    setupSpeechRecognition();

    // Footer voice button handler
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        if (isRecording) {
          stopRecording();
        } else {
          // Find a waiting session to record for
          window.electronAPI.getSessions().then(sessions => {
            const waitingSession = sessions.find(s => s.status === 'waiting');
            if (waitingSession) {
              startRecording(waitingSession.id);
            } else if (sessions.length > 0) {
              startRecording(sessions[0].id);
            } else {
              window.electronAPI.showNotification('Voice Error', 'No active sessions to send voice input');
            }
          }).catch(() => {
            window.electronAPI.showNotification('Voice Error', 'Could not fetch sessions');
          });
        }
      });
    }
  }

  // Listen for settings updates to refresh server status
  window.electronAPI.onSettingsUpdated((newSettings) => {
    updateServerStatus(newSettings.hookServerPort);
  });

  // Listen for recording commands from main process
  window.electronAPI.onStartRecording((sessionId) => {
    startRecording(sessionId);
  });

  window.electronAPI.onStopRecording(() => {
    stopRecording();
  });

  // Listen for incoming messages from external services
  // These handlers allow the UI to respond to messages received via SMS, Telegram, and Discord
  window.electronAPI.onSmsReceived((message) => {
    // The main process already handles sending input to Claude sessions
    // Show a brief notification in the renderer
    showMessageIndicator('SMS', message.from);
  });

  window.electronAPI.onTelegramReceived((message) => {
    showMessageIndicator('Telegram', message.username || 'Unknown');
  });

  window.electronAPI.onDiscordReceived((message) => {
    showMessageIndicator('Discord', message.username || 'Unknown');
  });
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
}

// Show a brief indicator when external messages are received
function showMessageIndicator(source: string, from: string) {
  // Update server status text briefly to show message received
  const originalText = serverStatusText.textContent;
  serverStatusText.textContent = `${source} from ${from}`;
  serverStatusDot.classList.add('message-received');

  setTimeout(() => {
    serverStatusText.textContent = originalText;
    serverStatusDot.classList.remove('message-received');
  }, 3000);
}

function renderSessions(sessions: ClaudeSession[]) {
  if (sessions.length === 0) {
    noSessionsEl.style.display = 'flex';
    sessionsListEl.style.display = 'none';
    return;
  }

  noSessionsEl.style.display = 'none';
  sessionsListEl.style.display = 'block';

  sessionsListEl.innerHTML = sessions
    .map(
      (session) => `
    <div class="session-card" data-session-id="${session.id}">
      <div class="session-header">
        <span class="session-name">${getSessionName(session)}</span>
        <div class="session-status ${session.status}">
          <span class="status-pulse"></span>
          ${session.status.charAt(0).toUpperCase() + session.status.slice(1)}
        </div>
      </div>
      <div class="session-directory">${session.workingDirectory !== 'Unknown' ? truncatePath(session.workingDirectory) : ''}</div>
      <div class="session-id-small">${session.id.substring(0, 8)}</div>
      ${session.currentTool ? `<div class="session-tool">Using: ${session.currentTool}</div>` : ''}
      ${session.status === 'waiting' && session.question ? `<div class="session-question">${escapeHtml(session.question)}</div>` : ''}
      ${session.status === 'waiting' && session.options && session.options.length > 0 ? `
        <div class="session-options">
          ${session.options.map((opt, idx) => `
            <button class="option-btn" data-action="select-option" data-session="${session.id}" data-value="${escapeHtml(opt.value)}" title="${opt.description ? escapeHtml(opt.description) : ''}">
              ${escapeHtml(opt.label)}
            </button>
          `).join('')}
        </div>
      ` : ''}
      ${session.lastNotification && session.lastNotification !== session.question ? `<div class="session-notification">${escapeHtml(session.lastNotification)}</div>` : ''}
      <div class="session-time">Started ${formatTime(session.startTime)}</div>
      ${
        session.status === 'waiting'
          ? `
        <div class="session-actions">
          <button class="session-btn input-btn" data-action="input" data-session="${session.id}">
            ${session.options && session.options.length > 0 ? 'Other...' : 'Send Input'}
          </button>
          <button class="session-btn voice-btn ${recordingSessionId === session.id ? 'recording' : ''}"
                  data-action="voice" data-session="${session.id}">
            ${recordingSessionId === session.id ? 'Stop' : 'Voice'}
          </button>
        </div>
      `
          : ''
      }
      ${
        session.status === 'stopped'
          ? `
        <div class="session-actions">
          <button class="session-btn clear-btn" data-action="clear" data-session="${session.id}">
            Clear
          </button>
        </div>
      `
          : ''
      }
    </div>
  `
    )
    .join('');

  // Add event listeners to buttons
  sessionsListEl.querySelectorAll('.session-btn').forEach((btn) => {
    btn.addEventListener('click', handleSessionAction);
  });

  // Add event listeners to option buttons
  sessionsListEl.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', handleOptionSelect);
  });
}

function truncatePath(path: string): string {
  if (!path || path === 'Unknown') {
    return 'Session active';
  }
  // Show just the project name (last folder)
  const parts = path.split('/').filter(Boolean);
  const projectName = parts[parts.length - 1] || path;

  if (path.length <= 40) return path;
  if (parts.length <= 2) return path;
  return `.../${parts.slice(-2).join('/')}`;
}

function getSessionName(session: ClaudeSession): string {
  // Priority 1: Use slug if available (e.g., "lexical-riding-yeti")
  if (session.slug) {
    return session.slug;
  }

  // Priority 2: Use project folder name from working directory
  if (session.workingDirectory && session.workingDirectory !== 'Unknown') {
    const parts = session.workingDirectory.split('/').filter(Boolean);
    const projectName = parts[parts.length - 1];
    if (projectName) {
      return projectName;
    }
  }

  // Priority 3: Fallback to truncated session ID
  return `session-${session.id.substring(0, 8)}`;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function handleSessionAction(event: Event) {
  const btn = event.currentTarget as HTMLButtonElement;
  const action = btn.dataset.action;
  const sessionId = btn.dataset.session;

  if (!sessionId) return;

  if (action === 'input') {
    showInputModal(sessionId);
  } else if (action === 'voice') {
    if (recordingSessionId === sessionId) {
      stopRecording();
    } else {
      startRecording(sessionId);
    }
  } else if (action === 'clear') {
    void clearSession(sessionId);
  }
}

// Handle clicking an option button
async function handleOptionSelect(event: Event) {
  const btn = event.currentTarget as HTMLButtonElement;
  const sessionId = btn.dataset.session;
  const value = btn.dataset.value;

  if (!sessionId || !value) return;

  // Disable button to prevent double-clicks
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const success = await window.electronAPI.sendInputToSession(sessionId, value);
    if (success) {
      window.electronAPI.showNotification('Input Sent', `Selected: ${value}`);
    } else {
      window.electronAPI.showNotification('Input Failed', 'Could not send selection to Claude');
      btn.disabled = false;
      btn.textContent = value;
    }
  } catch (error) {
    window.electronAPI.showNotification('Input Error', 'Failed to send selection');
    btn.disabled = false;
    btn.textContent = value;
  }
}

async function clearSession(sessionId: string) {
  try {
    await window.electronAPI.clearSession(sessionId);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

function showInputModal(sessionId: string) {
  currentInputSessionId = sessionId;
  inputSessionInfo.textContent = `Session: ${sessionId.substring(0, 8)}...`;
  inputText.value = '';
  inputModal.classList.remove('hidden');
  inputText.focus();
}

function hideInputModal() {
  inputModal.classList.add('hidden');
  currentInputSessionId = null;
  inputText.value = '';
}

async function sendInput() {
  if (!currentInputSessionId || !inputText.value.trim()) return;

  try {
    const success = await window.electronAPI.sendInputToSession(
      currentInputSessionId,
      inputText.value.trim()
    );

    if (success) {
      window.electronAPI.showNotification('Input Sent', 'Your input was sent to Claude');
    } else {
      window.electronAPI.showNotification('Input Failed', 'Could not send input to Claude session');
    }
  } catch (error) {
    window.electronAPI.showNotification('Input Error', 'Failed to send input');
  }

  hideInputModal();
}

// Speech Recognition - Web Speech API lacks proper TypeScript definitions
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
function setupSpeechRecognition() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRecognitionAPI =
    (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

  if (!SpeechRecognitionAPI) {
    console.log('Speech recognition not supported');
    return;
  }

  recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onresult = (event: any) => {
    const result = event.results[event.results.length - 1];
    const transcript = result[0].transcript as string;

    // Update voice status with interim results
    if (!result.isFinal) {
      updateVoiceStatus(transcript);
    }

    if (result.isFinal && recordingSessionId) {
      updateVoiceStatus(`Sent: "${transcript.substring(0, 30)}..."`);
      window.electronAPI.sendVoiceInputResult(recordingSessionId, transcript);
      stopRecording();
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onerror = (event: any) => {
    // Show user-friendly error messages
    let errorMessage = 'Voice recognition error';
    switch (event.error) {
      case 'no-speech':
        errorMessage = 'No speech detected';
        break;
      case 'audio-capture':
        errorMessage = 'Microphone not available';
        break;
      case 'not-allowed':
        errorMessage = 'Microphone access denied';
        break;
      case 'network':
        errorMessage = 'Network error';
        break;
      default:
        errorMessage = `Error: ${event.error}`;
    }
    updateVoiceStatus(errorMessage);
    window.electronAPI.showNotification('Voice Error', errorMessage);
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording && recognition) {
      // Restart if still recording
      updateVoiceStatus('Listening...');
      recognition.start();
    }
  };
}
/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
function startRecording(sessionId: string) {
  if (!recognition) {
    window.electronAPI.showNotification('Voice Error', 'Speech recognition not available');
    return;
  }

  isRecording = true;
  recordingSessionId = sessionId;
  updateVoiceStatus('Listening...');

  // Update footer button state
  if (voiceBtn) {
    voiceBtn.classList.add('recording');
    voiceBtn.textContent = '⏹️';
  }

  try {
    recognition.start();
    // Re-render to show recording state
    void window.electronAPI.getSessions().then(renderSessions).catch(() => {});
  } catch (e) {
    updateVoiceStatus('Failed to start');
    stopRecording();
  }
}

function stopRecording() {
  isRecording = false;
  recordingSessionId = null;

  // Clear voice status after a delay
  setTimeout(() => updateVoiceStatus(''), 2000);

  // Update footer button state
  if (voiceBtn) {
    voiceBtn.classList.remove('recording');
    voiceBtn.textContent = '🎤';
  }

  if (recognition) {
    recognition.stop();
  }

  // Re-render to clear recording state
  void window.electronAPI.getSessions().then(renderSessions).catch(() => {});
}
/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

// Event Listeners
settingsBtn.addEventListener('click', () => {
  window.electronAPI.openSettings();
});

minimizeBtn.addEventListener('click', () => {
  window.electronAPI.togglePopover();
});

inputCancel.addEventListener('click', hideInputModal);
inputSend.addEventListener('click', () => void sendInput());

inputText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    void sendInput();
  }
  if (e.key === 'Escape') {
    hideInputModal();
  }
});

// Close modal on backdrop click
inputModal.addEventListener('click', (e) => {
  if (e.target === inputModal) {
    hideInputModal();
  }
});

// Initialize
void init();

// Refresh sessions periodically
setInterval(() => {
  void window.electronAPI.getSessions()
    .then(renderSessions)
    .catch(() => {
      // Silently handle refresh errors - will retry on next interval
    });
}, 5000);
