// Jest setup file
// Mock Electron modules that aren't available in test environment

jest.mock('electron', () => ({
  app: {
    getAppPath: jest.fn(() => '/mock/app/path'),
    getPath: jest.fn((name: string) => `/mock/${name}`),
    whenReady: jest.fn(() => Promise.resolve()),
    quit: jest.fn(),
    requestSingleInstanceLock: jest.fn(() => true),
    on: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    loadURL: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    isDestroyed: jest.fn(() => false),
    isVisible: jest.fn(() => true),
    isMinimized: jest.fn(() => false),
    restore: jest.fn(),
    focus: jest.fn(),
    setPosition: jest.fn(),
    setOpacity: jest.fn(),
    setAlwaysOnTop: jest.fn(),
    webContents: {
      send: jest.fn(),
    },
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
  ipcRenderer: {
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  Notification: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    on: jest.fn(),
  })),
  nativeImage: {
    createFromPath: jest.fn(() => ({
      resize: jest.fn(() => ({})),
    })),
    createEmpty: jest.fn(() => ({})),
  },
  Tray: jest.fn().mockImplementation(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn(),
  })),
  Menu: {
    buildFromTemplate: jest.fn(() => ({})),
  },
  screen: {
    getPrimaryDisplay: jest.fn(() => ({
      workAreaSize: { width: 1920, height: 1080 },
    })),
  },
}));

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string, defaultValue: unknown) => defaultValue),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  }));
});

// Mock fs for tests that don't want real file system access
// Individual tests can override this
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(() => false),
    readFileSync: jest.fn(() => '{}'),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    unlinkSync: jest.fn(),
    readdirSync: jest.fn(() => []),
    statSync: jest.fn(() => ({ mtimeMs: Date.now() })),
  };
});

// Reset mocks between tests - use clearAllMocks to clear call history
// but keep implementations since we define defaults above
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(10000);
