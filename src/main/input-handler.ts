import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';

const WRAPPER_PORT_FILE = path.join(os.homedir(), '.claude', 'party-wrapper.port');

interface WrapperInfo {
  port: number;
  pid: number;
}

// Get the wrapper port from the port file
function getWrapperPort(): number | null {
  try {
    if (fs.existsSync(WRAPPER_PORT_FILE)) {
      const data = JSON.parse(fs.readFileSync(WRAPPER_PORT_FILE, 'utf-8')) as WrapperInfo;
      // Verify the process is still running
      try {
        process.kill(data.pid, 0); // Signal 0 just checks if process exists
        return data.port;
      } catch {
        // Process not running, clean up stale file
        fs.unlinkSync(WRAPPER_PORT_FILE);
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

// Send input via HTTP to the wrapper
function sendInputViaHttp(port: number, input: string): Promise<boolean> {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ input });

    const options = {
      hostname: '127.0.0.1',
      port,
      path: '/input',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('Input sent via HTTP to claude-party wrapper');
          resolve(true);
        } else {
          console.error('HTTP input failed:', data);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('HTTP request error:', err.message);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

// Send input to a running Claude Code session
// First tries HTTP to the claude-party wrapper, falls back to file-based
export async function sendInputToSession(sessionId: string, input: string): Promise<boolean> {
  // Method 1: Try HTTP to the wrapper
  const wrapperPort = getWrapperPort();
  if (wrapperPort) {
    const success = await sendInputViaHttp(wrapperPort, input);
    if (success) {
      return true;
    }
    console.log('HTTP failed, falling back to file-based input');
  }

  // Method 2: Write to a known input file (legacy/fallback)
  const inputDir = path.join(os.homedir(), '.claude', 'party-inputs');

  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(inputDir)) {
      fs.mkdirSync(inputDir, { recursive: true });
    }

    // Write input to a file for the session
    const inputFile = path.join(inputDir, `${sessionId}.input`);
    fs.writeFileSync(inputFile, input);

    console.log(`Input written for session ${sessionId}: ${input}`);
    return true;
  } catch (error) {
    console.error('Error sending input to session:', error);
    return false;
  }
}

// Synchronous version for backwards compatibility
export function sendInputToSessionSync(sessionId: string, input: string): boolean {
  const inputDir = path.join(os.homedir(), '.claude', 'party-inputs');

  try {
    if (!fs.existsSync(inputDir)) {
      fs.mkdirSync(inputDir, { recursive: true });
    }

    const inputFile = path.join(inputDir, `${sessionId}.input`);
    fs.writeFileSync(inputFile, input);

    console.log(`Input written for session ${sessionId}: ${input}`);
    return true;
  } catch (error) {
    console.error('Error sending input to session:', error);
    return false;
  }
}

// Read any pending input for a session (called from hook scripts)
export function readPendingInput(sessionId: string): string | null {
  const inputFile = path.join(os.homedir(), '.claude', 'party-inputs', `${sessionId}.input`);

  try {
    if (fs.existsSync(inputFile)) {
      const input = fs.readFileSync(inputFile, 'utf-8');
      // Delete the file after reading
      fs.unlinkSync(inputFile);
      return input;
    }
  } catch (error) {
    console.error('Error reading pending input:', error);
  }

  return null;
}

// Check if there's pending input for any session
export function hasPendingInput(sessionId: string): boolean {
  const inputFile = path.join(os.homedir(), '.claude', 'party-inputs', `${sessionId}.input`);
  return fs.existsSync(inputFile);
}

// Clean up old input files
export function cleanupOldInputs(): void {
  const inputDir = path.join(os.homedir(), '.claude', 'party-inputs');

  try {
    if (!fs.existsSync(inputDir)) return;

    const files = fs.readdirSync(inputDir);
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const file of files) {
      const filePath = path.join(inputDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error('Error cleaning up old inputs:', error);
  }
}
