import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Send input to a running Claude Code session
// Claude Code accepts input via stdin when waiting for user input
// We can use named pipes or the Claude API depending on how the session is running

export async function sendInputToSession(sessionId: string, input: string): Promise<boolean> {
  // Method 1: Write to a known input file that hook scripts can read
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
