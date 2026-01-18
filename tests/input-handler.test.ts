import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  sendInputToSession,
  readPendingInput,
  hasPendingInput,
  cleanupOldInputs,
} from '../src/main/input-handler';

describe('Input Handler Module', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const testSessionId = 'test-session-123';
  const inputDir = path.join(os.homedir(), '.claude', 'party-inputs');

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations to defaults
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('');
    mockFs.writeFileSync.mockImplementation(() => undefined);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.unlinkSync.mockImplementation(() => undefined);
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() } as unknown as ReturnType<
      typeof fs.statSync
    >);
  });

  describe('sendInputToSession', () => {
    it('should create directory if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await sendInputToSession(testSessionId, 'Hello Claude');

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(inputDir, { recursive: true });
    });

    it('should write input to correct file', async () => {
      mockFs.existsSync.mockReturnValue(true);

      await sendInputToSession(testSessionId, 'Test input message');

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(inputDir, `${testSessionId}.input`),
        'Test input message'
      );
    });

    it('should return true on success', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = await sendInputToSession(testSessionId, 'Test');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });

      const result = await sendInputToSession(testSessionId, 'Test');

      expect(result).toBe(false);
    });

    it('should handle empty input', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = await sendInputToSession(testSessionId, '');

      expect(result).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '');
    });

    it('should handle special characters in input', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const specialInput = 'Test with\nnewlines\tand\ttabs & "quotes"';
      await sendInputToSession(testSessionId, specialInput);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(expect.any(String), specialInput);
    });
  });

  describe('readPendingInput', () => {
    it('should return null if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = readPendingInput(testSessionId);

      expect(result).toBeNull();
    });

    it('should read and return file contents', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('Pending input text');

      const result = readPendingInput(testSessionId);

      expect(result).toBe('Pending input text');
    });

    it('should delete file after reading', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('Input');

      readPendingInput(testSessionId);

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        path.join(inputDir, `${testSessionId}.input`)
      );
    });

    it('should return null on read error', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = readPendingInput(testSessionId);

      expect(result).toBeNull();
    });
  });

  describe('hasPendingInput', () => {
    it('should return true if input file exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      expect(hasPendingInput(testSessionId)).toBe(true);
    });

    it('should return false if input file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(hasPendingInput(testSessionId)).toBe(false);
    });

    it('should check correct file path', () => {
      hasPendingInput(testSessionId);

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(inputDir, `${testSessionId}.input`)
      );
    });
  });

  describe('cleanupOldInputs', () => {
    it('should do nothing if directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      cleanupOldInputs();

      expect(mockFs.readdirSync).not.toHaveBeenCalled();
    });

    it('should delete files older than 5 minutes', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['old-session.input', 'new-session.input'] as any);

      const now = Date.now();
      mockFs.statSync
        .mockReturnValueOnce({ mtimeMs: now - 10 * 60 * 1000 } as any) // 10 min old
        .mockReturnValueOnce({ mtimeMs: now - 1 * 60 * 1000 } as any); // 1 min old

      cleanupOldInputs();

      // Only old file should be deleted
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(1);
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        path.join(inputDir, 'old-session.input')
      );
    });

    it('should keep files younger than 5 minutes', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['recent.input'] as any);
      mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() } as any);

      cleanupOldInputs();

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Read dir error');
      });

      // Should not throw
      expect(() => cleanupOldInputs()).not.toThrow();
    });
  });
});
