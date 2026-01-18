import { getSettings } from './store';
import { BrowserWindow } from 'electron';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { log } from './logger';

let isRecording = false;
let currentSessionId: string | null = null;
let popoverWindow: BrowserWindow | null = null;

export function setPopoverWindowForVoice(window: BrowserWindow | null): void {
  popoverWindow = window;
}

// Text-to-Speech using ElevenLabs
export async function speakText(text: string): Promise<void> {
  const settings = getSettings();

  if (!settings.elevenLabsApiKey || !settings.voiceOutputEnabled) {
    log.debug('Voice output disabled or no API key');
    return;
  }

  try {
    const audioBuffer = await generateSpeech(
      text,
      settings.elevenLabsApiKey,
      settings.elevenLabsVoiceId
    );
    await playAudio(audioBuffer);
  } catch (error) {
    log.error('Error speaking text', { error: error instanceof Error ? error.message : String(error) });
  }
}

function generateSpeech(text: string, apiKey: string, voiceId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`ElevenLabs API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function playAudio(audioBuffer: Buffer): Promise<void> {
  // Save to temp file and play using system audio
  const tempFile = path.join(os.tmpdir(), `claude-speech-${Date.now()}.mp3`);

  fs.writeFileSync(tempFile, audioBuffer);

  return new Promise((resolve, reject) => {
    let command: string;

    if (process.platform === 'darwin') {
      command = `afplay "${tempFile}"`;
    } else if (process.platform === 'win32') {
      command = `powershell -c "(New-Object Media.SoundPlayer '${tempFile}').PlaySync()"`;
    } else {
      // Linux
      command = `mpv "${tempFile}" --no-video 2>/dev/null || aplay "${tempFile}" 2>/dev/null || paplay "${tempFile}"`;
    }

    exec(command, (error: Error | null) => {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }

      if (error) {
        log.error('Error playing audio', { error: error.message });
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// Speech-to-Text - We'll use browser's Web Speech API in the renderer
// and send results back to main process
export function startVoiceInput(sessionId: string): boolean {
  if (isRecording) {
    return false;
  }

  isRecording = true;
  currentSessionId = sessionId;

  // Notify renderer to start recording
  if (popoverWindow && !popoverWindow.isDestroyed()) {
    popoverWindow.webContents.send('start-recording', sessionId);
  }

  return true;
}

export function stopVoiceInput(): { sessionId: string | null } {
  const sessionId = currentSessionId;
  isRecording = false;
  currentSessionId = null;

  // Notify renderer to stop recording
  if (popoverWindow && !popoverWindow.isDestroyed()) {
    popoverWindow.webContents.send('stop-recording');
  }

  return { sessionId };
}

export function isVoiceInputActive(): boolean {
  return isRecording;
}

export function getCurrentVoiceSessionId(): string | null {
  return currentSessionId;
}

/**
 * Speech-to-Text transcription.
 *
 * NOTE: ElevenLabs focuses on TTS (text-to-speech), not STT (speech-to-text).
 * This application uses the browser's Web Speech API for voice input, which:
 * - Is free (no API key required)
 * - Works offline in some browsers
 * - Runs in the renderer process via the popover UI
 *
 * If ElevenLabs adds STT in the future, this function can be implemented.
 * For now, voice input is handled in src/renderer/popover/renderer.ts
 * using the Web Speech API (webkitSpeechRecognition).
 *
 * @throws Error Always throws since STT is not implemented via ElevenLabs
 */
export function transcribeWithElevenLabs(_audioBlob: Buffer): never {
  throw new Error(
    'ElevenLabs STT is not implemented. Voice input uses Web Speech API in the renderer. ' +
    'See src/renderer/popover/renderer.ts for the speech recognition implementation.'
  );
}
