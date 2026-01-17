import { getSettings } from './store';
import * as https from 'https';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS, SmsMessage } from '../shared/types';

let smsServer: Server | null = null;
let mainWindow: BrowserWindow | null = null;

export function setMainWindowForSms(window: BrowserWindow | null): void {
  mainWindow = window;
}

// Send SMS using Twilio
export async function sendSms(message: string, toNumber?: string): Promise<boolean> {
  const settings = getSettings();

  if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioPhoneNumber) {
    console.log('Twilio not configured');
    return false;
  }

  const to = toNumber || settings.userPhoneNumber;
  if (!to) {
    console.log('No recipient phone number');
    return false;
  }

  try {
    await sendTwilioSms(
      settings.twilioAccountSid,
      settings.twilioAuthToken,
      settings.twilioPhoneNumber,
      to,
      message
    );
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

function sendTwilioSms(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      To: to,
      From: from,
      Body: body
    }).toString();

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          console.log('SMS sent successfully');
          resolve();
        } else {
          console.error('Twilio error response:', data);
          reject(new Error(`Twilio API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Webhook server for receiving SMS (requires ngrok or similar for local dev)
export function startSmsWebhookServer(port: number = 31549): void {
  if (smsServer) {
    smsServer.close();
  }

  smsServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end();
      return;
    }

    try {
      const body = await parseFormData(req);

      const smsMessage: SmsMessage = {
        from: body.From || '',
        to: body.To || '',
        body: body.Body || '',
        timestamp: Date.now(),
        direction: 'inbound'
      };

      console.log('Received SMS:', smsMessage);

      // Notify renderer about received SMS
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.SMS_RECEIVED, smsMessage);
      }

      // Respond with TwiML to acknowledge
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      console.error('Error processing incoming SMS:', error);
      res.writeHead(500);
      res.end();
    }
  });

  smsServer.listen(port, '127.0.0.1', () => {
    console.log(`SMS webhook server listening on http://127.0.0.1:${port}`);
  });
}

function parseFormData(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => body += chunk.toString());
    req.on('end', () => {
      try {
        const params = new URLSearchParams(body);
        const result: Record<string, string> = {};
        params.forEach((value, key) => {
          result[key] = value;
        });
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function stopSmsWebhookServer(): void {
  if (smsServer) {
    smsServer.close();
    smsServer = null;
  }
}

// Process incoming SMS as potential input for Claude
export function processIncomingSms(message: SmsMessage): { isCommand: boolean; sessionId?: string; input?: string } {
  const body = message.body.trim();

  // Check for command format: "session:input" or just input for latest session
  const commandMatch = body.match(/^(\w+):(.+)$/);

  if (commandMatch) {
    return {
      isCommand: true,
      sessionId: commandMatch[1],
      input: commandMatch[2].trim()
    };
  }

  // Treat as input for the latest active session
  return {
    isCommand: true,
    input: body
  };
}
