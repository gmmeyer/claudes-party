import { getSettings, saveSettings } from './store';
import * as https from 'https';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { BrowserWindow } from 'electron';
import {
  IPC_CHANNELS,
  SmsMessage,
  TwilioPhoneNumber,
  TwilioAvailableNumber,
  SetupResult,
} from '../shared/types';
import { sendInputToSession } from './input-handler';
import { getSessions, getSession } from './sessions';

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
      Body: body,
    }).toString();

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
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

// Get list of phone numbers owned by the account
export async function getTwilioPhoneNumbers(): Promise<TwilioPhoneNumber[]> {
  const settings = getSettings();

  if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
    throw new Error('Twilio credentials not configured');
  }

  return new Promise((resolve, reject) => {
    const auth = Buffer.from(
      `${settings.twilioAccountSid}:${settings.twilioAuthToken}`
    ).toString('base64');

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${settings.twilioAccountSid}/IncomingPhoneNumbers.json`,
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data) as {
              incoming_phone_numbers: Array<{
                phone_number: string;
                friendly_name: string;
                capabilities: { sms: boolean; voice: boolean; mms: boolean };
                iso_country: string;
              }>;
            };
            const numbers: TwilioPhoneNumber[] = response.incoming_phone_numbers.map((n) => ({
              phoneNumber: n.phone_number,
              friendlyName: n.friendly_name,
              capabilities: n.capabilities,
              country: n.iso_country,
            }));
            resolve(numbers);
          } catch (e) {
            reject(new Error('Failed to parse Twilio response'));
          }
        } else {
          reject(new Error(`Twilio API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Search for available phone numbers to purchase
export async function searchAvailableNumbers(
  countryCode: string = 'US'
): Promise<TwilioAvailableNumber[]> {
  const settings = getSettings();

  if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
    throw new Error('Twilio credentials not configured');
  }

  return new Promise((resolve, reject) => {
    const auth = Buffer.from(
      `${settings.twilioAccountSid}:${settings.twilioAuthToken}`
    ).toString('base64');

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${settings.twilioAccountSid}/AvailablePhoneNumbers/${countryCode}/Local.json?SmsEnabled=true&PageSize=10`,
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data) as {
              available_phone_numbers: Array<{
                phone_number: string;
                friendly_name: string;
                locality?: string;
                region?: string;
                iso_country: string;
                capabilities: { sms: boolean; voice: boolean; mms: boolean };
              }>;
            };
            const numbers: TwilioAvailableNumber[] = response.available_phone_numbers.map((n) => ({
              phoneNumber: n.phone_number,
              friendlyName: n.friendly_name,
              locality: n.locality,
              region: n.region,
              country: n.iso_country,
              capabilities: n.capabilities,
            }));
            resolve(numbers);
          } catch (e) {
            reject(new Error('Failed to parse Twilio response'));
          }
        } else {
          reject(new Error(`Twilio API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Purchase a phone number
export async function buyPhoneNumber(phoneNumber: string): Promise<TwilioPhoneNumber> {
  const settings = getSettings();

  if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
    throw new Error('Twilio credentials not configured');
  }

  return new Promise((resolve, reject) => {
    const auth = Buffer.from(
      `${settings.twilioAccountSid}:${settings.twilioAuthToken}`
    ).toString('base64');

    const postData = new URLSearchParams({
      PhoneNumber: phoneNumber,
    }).toString();

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${settings.twilioAccountSid}/IncomingPhoneNumbers.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode === 201) {
          try {
            const response = JSON.parse(data) as {
              phone_number: string;
              friendly_name: string;
              capabilities: { sms: boolean; voice: boolean; mms: boolean };
              iso_country: string;
            };
            resolve({
              phoneNumber: response.phone_number,
              friendlyName: response.friendly_name,
              capabilities: response.capabilities,
              country: response.iso_country,
            });
          } catch (e) {
            reject(new Error('Failed to parse Twilio response'));
          }
        } else {
          reject(new Error(`Twilio API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Configure webhook URL for a phone number
export async function configureWebhook(
  phoneNumberSid: string,
  webhookUrl: string
): Promise<void> {
  const settings = getSettings();

  if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
    throw new Error('Twilio credentials not configured');
  }

  return new Promise((resolve, reject) => {
    const auth = Buffer.from(
      `${settings.twilioAccountSid}:${settings.twilioAuthToken}`
    ).toString('base64');

    const postData = new URLSearchParams({
      SmsUrl: webhookUrl,
      SmsMethod: 'POST',
    }).toString();

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${settings.twilioAccountSid}/IncomingPhoneNumbers/${phoneNumberSid}.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Twilio API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Get phone number SID by phone number
async function getPhoneNumberSid(phoneNumber: string): Promise<string | null> {
  const settings = getSettings();

  if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
    throw new Error('Twilio credentials not configured');
  }

  return new Promise((resolve, reject) => {
    const auth = Buffer.from(
      `${settings.twilioAccountSid}:${settings.twilioAuthToken}`
    ).toString('base64');

    const encodedNumber = encodeURIComponent(phoneNumber);
    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${settings.twilioAccountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodedNumber}`,
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data) as {
              incoming_phone_numbers: Array<{ sid: string }>;
            };
            if (response.incoming_phone_numbers.length > 0) {
              resolve(response.incoming_phone_numbers[0].sid);
            } else {
              resolve(null);
            }
          } catch (e) {
            reject(new Error('Failed to parse Twilio response'));
          }
        } else {
          reject(new Error(`Twilio API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Full auto-setup: buy number if needed, configure webhook
export async function setupTwilio(webhookUrl: string): Promise<SetupResult> {
  const settings = getSettings();

  if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
    return { success: false, message: 'Twilio credentials not configured' };
  }

  try {
    // Check if we already have a phone number
    let phoneNumber = settings.twilioPhoneNumber;
    let phoneNumberSid: string | null = null;

    if (phoneNumber) {
      // Verify the number exists
      phoneNumberSid = await getPhoneNumberSid(phoneNumber);
      if (!phoneNumberSid) {
        console.log('Configured phone number not found in account, will search for new one');
        phoneNumber = '';
      }
    }

    // If no phone number, check if account has any numbers
    if (!phoneNumber) {
      const existingNumbers = await getTwilioPhoneNumbers();
      if (existingNumbers.length > 0) {
        // Use first SMS-capable number
        const smsNumber = existingNumbers.find((n) => n.capabilities.sms);
        if (smsNumber) {
          phoneNumber = smsNumber.phoneNumber;
          console.log(`Using existing number: ${phoneNumber}`);
        }
      }
    }

    // If still no number, buy one
    if (!phoneNumber) {
      console.log('No phone number found, searching for available numbers...');
      const availableNumbers = await searchAvailableNumbers('US');

      if (availableNumbers.length === 0) {
        return { success: false, message: 'No phone numbers available for purchase' };
      }

      console.log(`Purchasing number: ${availableNumbers[0].phoneNumber}`);
      const purchasedNumber = await buyPhoneNumber(availableNumbers[0].phoneNumber);
      phoneNumber = purchasedNumber.phoneNumber;
    }

    // Get the SID for the number
    phoneNumberSid = await getPhoneNumberSid(phoneNumber);
    if (!phoneNumberSid) {
      return { success: false, message: 'Failed to find phone number SID' };
    }

    // Configure webhook
    if (webhookUrl) {
      console.log(`Configuring webhook: ${webhookUrl}`);
      await configureWebhook(phoneNumberSid, webhookUrl);
    }

    // Save the phone number to settings
    saveSettings({
      twilioPhoneNumber: phoneNumber,
      twilioWebhookUrl: webhookUrl,
    });

    return {
      success: true,
      message: `Twilio setup complete. Phone number: ${phoneNumber}`,
      data: { phoneNumber, webhookUrl },
    };
  } catch (error) {
    console.error('Twilio setup error:', error);
    return {
      success: false,
      message: `Setup failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Webhook server for receiving SMS (requires ngrok or similar for local dev)
export function startSmsWebhookServer(port: number = 31549): void {
  if (smsServer) {
    smsServer.close();
  }

  smsServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
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
          direction: 'inbound',
        };

        console.log('Received SMS:', smsMessage);

        // Notify renderer about received SMS
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.SMS_RECEIVED, smsMessage);
        }

        // Auto-process incoming SMS as Claude input if enabled
        const settings = getSettings();
        if (settings.smsReplyEnabled) {
          await handleIncomingSmsAsInput(smsMessage);
        }

        // Respond with TwiML to acknowledge
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      } catch (error) {
        console.error('Error processing incoming SMS:', error);
        res.writeHead(500);
        res.end();
      }
    })();
  });

  smsServer.listen(port, '127.0.0.1', () => {
    console.log(`SMS webhook server listening on http://127.0.0.1:${port}`);
  });
}

function parseFormData(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
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

// Process incoming SMS and send input to Claude session
async function handleIncomingSmsAsInput(message: SmsMessage): Promise<void> {
  const parsed = processIncomingSms(message);

  if (!parsed.input) {
    console.log('No input found in SMS');
    return;
  }

  let targetSessionId = parsed.sessionId;

  // If no session specified, find the most recent waiting session
  if (!targetSessionId) {
    const sessions = getSessions();
    const waitingSession = sessions.find((s) => s.status === 'waiting');
    if (waitingSession) {
      targetSessionId = waitingSession.id;
    } else {
      // Fall back to most recent active session
      const activeSession = sessions
        .filter((s) => s.status === 'active')
        .sort((a, b) => b.lastActivity - a.lastActivity)[0];
      if (activeSession) {
        targetSessionId = activeSession.id;
      }
    }
  }

  if (!targetSessionId) {
    console.log('No active session found for SMS input');
    // Send response via SMS
    await sendSms('No active Claude session found to send your message to.');
    return;
  }

  // Verify session exists
  const session = getSession(targetSessionId);
  if (!session) {
    console.log(`Session ${targetSessionId} not found`);
    await sendSms(`Session "${targetSessionId}" not found.`);
    return;
  }

  // Send input to session
  const success = sendInputToSession(targetSessionId, parsed.input);

  if (success) {
    console.log(`SMS input sent to session ${targetSessionId}: ${parsed.input}`);
    // Optionally confirm via SMS
    const truncatedInput =
      parsed.input.length > 50 ? parsed.input.substring(0, 50) + '...' : parsed.input;
    await sendSms(`Sent to Claude: "${truncatedInput}"`);
  } else {
    console.error(`Failed to send SMS input to session ${targetSessionId}`);
    await sendSms('Failed to send your message to Claude.');
  }
}

// Process incoming SMS as potential input for Claude
export function processIncomingSms(message: SmsMessage): {
  isCommand: boolean;
  sessionId?: string;
  input?: string;
} {
  const body = message.body.trim();

  // Check for command format: "session:input" or just input for latest session
  const commandMatch = body.match(/^(\w+):(.+)$/s);

  if (commandMatch) {
    return {
      isCommand: true,
      sessionId: commandMatch[1],
      input: commandMatch[2].trim(),
    };
  }

  // Treat as input for the latest active session
  return {
    isCommand: true,
    input: body,
  };
}
