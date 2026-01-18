#!/usr/bin/env node
/**
 * claude-party CLI wrapper
 *
 * Wraps Claude Code and provides an HTTP server for receiving input commands.
 * This allows external applications (like the Claude's Party desktop app)
 * to send input to a running Claude Code session.
 *
 * Usage:
 *   claude-party [claude-code-args...]
 *
 * Example:
 *   claude-party                    # Start Claude Code with input server
 *   claude-party --resume abc123    # Resume a session with input server
 *   claude-party -p "hello"         # Print mode (server not needed)
 */

import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DEFAULT_PORT = 31550;
const PORT_FILE = path.join(os.homedir(), '.claude', 'party-wrapper.port');
const PID_FILE = path.join(os.homedir(), '.claude', 'party-wrapper.pid');

interface InputRequest {
  sessionId?: string;
  input: string;
}

interface ServerState {
  server: http.Server | null;
  claudeProcess: ChildProcess | null;
  port: number;
  sessionId: string | null;
}

const state: ServerState = {
  server: null,
  claudeProcess: null,
  port: DEFAULT_PORT,
  sessionId: null,
};

function log(message: string): void {
  console.error(`[claude-party] ${message}`);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writePortFile(port: number): void {
  ensureDir(path.dirname(PORT_FILE));
  fs.writeFileSync(PORT_FILE, JSON.stringify({ port, pid: process.pid }));
}

function writePidFile(): void {
  ensureDir(path.dirname(PID_FILE));
  fs.writeFileSync(PID_FILE, process.pid.toString());
}

function cleanup(): void {
  try {
    if (fs.existsSync(PORT_FILE)) fs.unlinkSync(PORT_FILE);
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch {
    // Ignore cleanup errors
  }
}

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(startPort, '127.0.0.1', () => {
      server.close(() => resolve(startPort));
    });
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

function startInputServer(port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health check
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            sessionId: state.sessionId,
            claudeRunning: state.claudeProcess !== null && state.claudeProcess.exitCode === null,
          })
        );
        return;
      }

      // Send input
      if (req.method === 'POST' && req.url === '/input') {
        let body = '';
        req.on('data', (chunk: Buffer) => (body += chunk.toString()));
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as InputRequest;

            if (!data.input) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing input field' }));
              return;
            }

            if (!state.claudeProcess || state.claudeProcess.exitCode !== null) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Claude process not running' }));
              return;
            }

            // Write to Claude's stdin
            const written = state.claudeProcess.stdin?.write(data.input + '\n');

            if (written) {
              log(
                `Input sent: ${data.input.substring(0, 50)}${data.input.length > 50 ? '...' : ''}`
              );
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, sessionId: state.sessionId }));
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to write to stdin' }));
            }
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      // 404 for other routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(port, '127.0.0.1', () => {
      log(`Input server listening on http://127.0.0.1:${port}`);
      resolve(server);
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

function extractSessionId(args: string[]): string | null {
  // Look for --resume or -r flag
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--resume' || args[i] === '-r') && args[i + 1]) {
      return args[i + 1];
    }
    if (args[i].startsWith('--resume=')) {
      return args[i].split('=')[1];
    }
  }
  return null;
}

function spawnClaude(args: string[]): ChildProcess {
  // Find claude executable
  const claudeCmd = process.platform === 'win32' ? 'claude.cmd' : 'claude';

  log(`Starting: ${claudeCmd} ${args.join(' ')}`);

  const claude = spawn(claudeCmd, args, {
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
  });

  claude.on('error', (err) => {
    log(`Failed to start Claude: ${err.message}`);
    process.exit(1);
  });

  claude.on('exit', (code) => {
    log(`Claude exited with code ${code}`);
    cleanup();
    process.exit(code ?? 0);
  });

  return claude;
}

async function main(): Promise<void> {
  // Get args (skip node and script path)
  const args = process.argv.slice(2);

  // Check for help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
claude-party - Claude Code wrapper with remote input support

Usage:
  claude-party [options] [claude-code-args...]

Options:
  --port <port>    Port for input server (default: ${DEFAULT_PORT})
  --help, -h       Show this help message

The wrapper starts an HTTP server that accepts input commands:
  POST /input      Send input to Claude (body: {"input": "your message"})
  GET /health      Check if Claude is running

Examples:
  claude-party                      Start Claude with input server
  claude-party --resume abc123      Resume session with input server
  claude-party --port 8080          Use custom port

Send input from another terminal:
  curl -X POST http://127.0.0.1:${DEFAULT_PORT}/input \\
    -H "Content-Type: application/json" \\
    -d '{"input": "yes"}'
`);
    process.exit(0);
  }

  // Extract our custom args
  let port = DEFAULT_PORT;
  const claudeArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++; // Skip next arg
    } else {
      claudeArgs.push(args[i]);
    }
  }

  // Extract session ID from claude args
  state.sessionId = extractSessionId(claudeArgs);

  // Find available port
  state.port = await findAvailablePort(port);
  if (state.port !== port) {
    log(`Port ${port} in use, using ${state.port}`);
  }

  // Write port file so the desktop app can find us
  writePortFile(state.port);
  writePidFile();

  // Handle termination
  process.on('SIGINT', () => {
    log('Interrupted, shutting down...');
    cleanup();
    state.claudeProcess?.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('Terminated, shutting down...');
    cleanup();
    state.claudeProcess?.kill('SIGTERM');
    process.exit(0);
  });

  // Start input server
  try {
    state.server = await startInputServer(state.port);
  } catch (err: unknown) {
    log(`Failed to start input server: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Start Claude
  state.claudeProcess = spawnClaude(claudeArgs);

  // Generate a session ID if we don't have one
  if (!state.sessionId) {
    state.sessionId = `party-${Date.now().toString(36)}`;
  }

  log(`Session ID: ${state.sessionId}`);
  log(
    `Send input: curl -X POST http://127.0.0.1:${state.port}/input -d '{"input":"your message"}'`
  );
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  cleanup();
  process.exit(1);
});
