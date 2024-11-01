import { describe, test, expect, vi, beforeEach } from 'vitest';
import { StorageManager } from '../storage';

// Mock IndexedDB
const indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

const IDBRequest = {
  result: {
    createObjectStore: vi.fn(),
    transaction: vi.fn(),
    close: vi.fn(),
    version: 1,
  },
  onerror: vi.fn(),
  onsuccess: vi.fn(),
  onupgradeneeded: vi.fn(),
};

const IDBTransaction = {
  objectStore: vi.fn(),
  oncomplete: vi.fn(),
  onerror: vi.fn(),
};

const IDBObjectStore = {
  add: vi.fn(),
  getAll: vi.fn(),
  delete: vi.fn(),
};

// Setup global mocks
vi.stubGlobal('indexedDB', indexedDB);

describe('StorageManager', () => {
  let storage: StorageManager;

  beforeEach(() => {
    // Enable fake timers
    vi.useFakeTimers();
    
    vi.clearAllMocks();
    
    // Setup IndexedDB mock behavior
    indexedDB.open.mockReturnValue(IDBRequest);
    IDBRequest.result.transaction.mockReturnValue(IDBTransaction);
    IDBTransaction.objectStore.mockReturnValue(IDBObjectStore);
    
    storage = new StorageManager();
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
  });

  describe('init', () => {
    test('initializes database successfully', async () => {
      const initPromise = storage.init();
      
      // Simulate successful database open
      IDBRequest.onsuccess(new Event('success'));
      
      // Fast-forward any timers
      await vi.runAllTimersAsync();
      
      await expect(initPromise).resolves.toBeUndefined();
      expect(indexedDB.open).toHaveBeenCalled();
    });

    test('handles database open error', async () => {
      indexedDB.open.mockImplementation(() => {
        throw new Error('Failed to open database');
      });

      await expect(storage.init()).rejects.toThrow('Failed to open database');
    });

    test('creates object store during upgrade', async () => {
      const initPromise = storage.init();
      
      // Simulate database upgrade
      IDBRequest.onupgradeneeded(new Event('upgradeneeded'));
      IDBRequest.onsuccess(new Event('success'));
      
      // Fast-forward any timers
      await vi.runAllTimersAsync();
      
      await initPromise;
      expect(IDBRequest.result.createObjectStore).toHaveBeenCalled();
    });
  });

  describe('storePendingEvents', () => {
    test('stores events successfully', async () => {
      const events = [{
        id: '1',
        type: 'test',
        timestamp: Date.now(),
        context: {},
        element: { tag: 'button', attributes: {} }
      }];

      // Initialize storage
      const initPromise = storage.init();
      IDBRequest.onsuccess(new Event('success'));
      await initPromise;

      // Setup store success
      IDBObjectStore.add.mockImplementation(() => ({
        onsuccess: vi.fn()
      }));

      const storePromise = storage.storePendingEvents(events);
      IDBTransaction.oncomplete(new Event('complete'));

      // Fast-forward any timers
      await vi.runAllTimersAsync();

      await expect(storePromise).resolves.toBeUndefined();
      expect(IDBObjectStore.add).toHaveBeenCalledWith(events[0]);
    });

    test('handles store error', async () => {
      const events = [{
        id: '1',
        type: 'test',
        timestamp: Date.now(),
        context: {},
        element: { tag: 'button', attributes: {} }
      }];

      // Initialize storage
      const initPromise = storage.init();
      IDBRequest.onsuccess(new Event('success'));
      await initPromise;

      // Setup store error
      IDBTransaction.onerror(new Error('Store failed'));

      await expect(storage.storePendingEvents(events)).rejects.toThrow();
    });
  });

  describe('getPendingEvents', () => {
    test('retrieves events successfully', async () => {
      const events = [{
        id: '1',
        type: 'test',
        timestamp: Date.now(),
        context: {},
        element: { tag: 'button', attributes: {} }
      }];

      // Initialize storage
      const initPromise = storage.init();
      IDBRequest.onsuccess(new Event('success'));
      await initPromise;

      // Setup successful retrieval
      IDBObjectStore.getAll.mockImplementation(() => ({
        onsuccess: (e: any) => {
          e.target.result = events;
          e.target.onsuccess?.();
        }
      }));

      // Fast-forward any timers
      await vi.runAllTimersAsync();

      const result = await storage.getPendingEvents();
      expect(result).toEqual(events);
    });

    test('handles retrieval error', async () => {
      // Initialize storage
      const initPromise = storage.init();
      IDBRequest.onsuccess(new Event('success'));
      await initPromise;

      // Setup retrieval error
      IDBObjectStore.getAll.mockImplementation(() => ({
        onerror: (e: any) => {
          e.target.error = new Error('Retrieval failed');
          e.target.onerror?.();
        }
      }));

      await expect(storage.getPendingEvents()).rejects.toThrow();
    });
  });

  describe('clearPendingEvents', () => {
    test('clears events successfully', async () => {
      const events = [{
        id: '1',
        type: 'test',
        timestamp: Date.now(),
        context: {},
        element: { tag: 'button', attributes: {} }
      }];

      // Initialize storage
      const initPromise = storage.init();
      IDBRequest.onsuccess(new Event('success'));
      await initPromise;

      // Setup successful deletion
      IDBObjectStore.delete.mockImplementation(() => ({
        onsuccess: vi.fn()
      }));

      const clearPromise = storage.clearPendingEvents(events);
      IDBTransaction.oncomplete(new Event('complete'));

      // Fast-forward any timers
      await vi.runAllTimersAsync();

      await expect(clearPromise).resolves.toBeUndefined();
      expect(IDBObjectStore.delete).toHaveBeenCalledWith(['1', events[0].timestamp]);
    });

    test('handles clear error', async () => {
      const events = [{
        id: '1',
        type: 'test',
        timestamp: Date.now(),
        context: {},
        element: { tag: 'button', attributes: {} }
      }];

      // Initialize storage
      const initPromise = storage.init();
      IDBRequest.onsuccess(new Event('success'));
      await initPromise;

      // Setup deletion error
      IDBTransaction.onerror(new Error('Clear failed'));

      await expect(storage.clearPendingEvents(events)).rejects.toThrow();
    });
  });
});