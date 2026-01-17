// Claude session interface
interface ClaudeSession {
  id: string;
  workingDirectory: string;
  startTime: number;
  status: 'active' | 'waiting' | 'stopped';
  lastActivity: number;
  currentTool?: string;
  lastNotification?: string;
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
const serverStatusDot = document.getElementById('server-status-dot') as HTMLSpanElement;
const serverStatusText = document.getElementById('server-status-text') as HTMLSpanElement;

let currentInputSessionId: string | null = null;
let isRecording = false;
let recordingSessionId: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recognition: any = null;

// Initialize
async function init() {
  // Load initial sessions
  const sessions = await window.electronAPI.getSessions();
  renderSessions(sessions);

  // Listen for session updates
  window.electronAPI.onSessionsUpdated((sessions) => {
    renderSessions(sessions);
  });

  // Check if voice input is available
  const settings = await window.electronAPI.getSettings();
  if (settings.voiceInputEnabled && 'webkitSpeechRecognition' in window) {
    voiceControls.style.display = 'flex';
    setupSpeechRecognition();
  }

  // Listen for recording commands from main process
  window.electronAPI.onStartRecording((sessionId) => {
    startRecording(sessionId);
  });

  window.electronAPI.onStopRecording(() => {
    stopRecording();
  });
}

function renderSessions(sessions: ClaudeSession[]) {
  if (sessions.length === 0) {
    noSessionsEl.style.display = 'flex';
    sessionsListEl.style.display = 'none';
    return;
  }

  noSessionsEl.style.display = 'none';
  sessionsListEl.style.display = 'block';

  sessionsListEl.innerHTML = sessions.map(session => `
    <div class="session-card" data-session-id="${session.id}">
      <div class="session-header">
        <span class="session-id">${session.id.substring(0, 8)}...</span>
        <div class="session-status ${session.status}">
          <span class="status-pulse"></span>
          ${session.status.charAt(0).toUpperCase() + session.status.slice(1)}
        </div>
      </div>
      <div class="session-directory">${truncatePath(session.workingDirectory)}</div>
      ${session.currentTool ? `<div class="session-tool">Using: ${session.currentTool}</div>` : ''}
      ${session.lastNotification ? `<div class="session-notification">${session.lastNotification}</div>` : ''}
      <div class="session-time">Started ${formatTime(session.startTime)}</div>
      ${session.status === 'waiting' ? `
        <div class="session-actions">
          <button class="session-btn input-btn" data-action="input" data-session="${session.id}">
            Send Input
          </button>
          <button class="session-btn voice-btn ${recordingSessionId === session.id ? 'recording' : ''}"
                  data-action="voice" data-session="${session.id}">
            ${recordingSessionId === session.id ? 'Stop' : 'Voice'}
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');

  // Add event listeners to buttons
  sessionsListEl.querySelectorAll('.session-btn').forEach(btn => {
    btn.addEventListener('click', handleSessionAction);
  });
}

function truncatePath(path: string): string {
  if (path.length <= 40) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return path;
  return `.../${parts.slice(-2).join('/')}`;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
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

  const success = await window.electronAPI.sendInputToSession(
    currentInputSessionId,
    inputText.value.trim()
  );

  if (success) {
    window.electronAPI.showNotification('Input Sent', 'Your input was sent to Claude');
  }

  hideInputModal();
}

// Speech Recognition
function setupSpeechRecognition() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRecognitionAPI = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

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
    const transcript = result[0].transcript;

    if (result.isFinal && recordingSessionId) {
      window.electronAPI.sendVoiceInputResult(recordingSessionId, transcript);
      stopRecording();
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onerror = (event: any) => {
    console.error('Speech recognition error:', event.error);
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording && recognition) {
      // Restart if still recording
      recognition.start();
    }
  };
}

function startRecording(sessionId: string) {
  if (!recognition) {
    window.electronAPI.showNotification('Voice Error', 'Speech recognition not available');
    return;
  }

  isRecording = true;
  recordingSessionId = sessionId;

  try {
    recognition.start();
    // Re-render to show recording state
    window.electronAPI.getSessions().then(renderSessions);
  } catch (e) {
    console.error('Error starting recognition:', e);
    stopRecording();
  }
}

function stopRecording() {
  isRecording = false;
  recordingSessionId = null;

  if (recognition) {
    recognition.stop();
  }

  // Re-render to clear recording state
  window.electronAPI.getSessions().then(renderSessions);
}

// Event Listeners
settingsBtn.addEventListener('click', () => {
  window.electronAPI.openSettings();
});

minimizeBtn.addEventListener('click', () => {
  window.electronAPI.togglePopover();
});

inputCancel.addEventListener('click', hideInputModal);
inputSend.addEventListener('click', sendInput);

inputText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendInput();
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
init();

// Refresh sessions periodically
setInterval(async () => {
  const sessions = await window.electronAPI.getSessions();
  renderSessions(sessions);
}, 5000);
