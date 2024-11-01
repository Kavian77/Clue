import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoreTracker } from '../index';
import { type TrackerOptions, type TrackingEvent, type Tracker } from '../types';

// Mock fetch
const fetch = vi.fn();
vi.stubGlobal('fetch', fetch);

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

// Mock navigator
const navigator = {
  onLine: true,
};

// Mock window
const addEventListener = vi.fn();
const removeEventListener = vi.fn();

// Setup global mocks
vi.stubGlobal('indexedDB', indexedDB);
vi.stubGlobal('navigator', navigator);
vi.stubGlobal('addEventListener', addEventListener);
vi.stubGlobal('removeEventListener', removeEventListener);

// Mock tracker implementation
class MockTracker implements Tracker {
  public readonly type = 'mock';
  public started = false;
  public stopped = false;

  constructor(private options: TrackerOptions) {}

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.stopped = true;
  }

  track(event: TrackingEvent): void {
    if (this.options.onBatchDispatch) {
      void this.options.onBatchDispatch([event]);
    }
  }
}

describe('CoreTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    indexedDB.open.mockReturnValue(IDBRequest);
    IDBRequest.result.transaction.mockReturnValue(IDBTransaction);
    IDBTransaction.objectStore.mockReturnValue(IDBObjectStore);

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    // Setup default fetch mock
    fetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    (CoreTracker as any).instance = null;
    vi.useRealTimers();
  });

  describe('event sending', () => {
    test('sends events to configured endpoint', async () => {
      const event: TrackingEvent = {
        id: '1',
        type: 'test',
        timestamp: Date.now(),
        context: {},
        element: { tag: 'button', attributes: {} },
      };

      const tracker = CoreTracker.getInstance({
        endpoint: 'https://api.example.com/events',
        headers: { 'X-Custom': 'value' },
      });

      await (tracker as any).track(event);
      await (tracker as any).tryProcessPendingEvents();

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/events',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom': 'value',
          }),
          body: JSON.stringify({ events: [event] }),
        })
      );
    });

    test('applies middlewares before sending', async () => {
      const event: TrackingEvent = {
        id: '1',
        type: 'test',
        timestamp: Date.now(),
        context: {},
        element: { tag: 'button', attributes: {} },
      };

      const middleware = vi.fn().mockImplementation(events => 
        events.map(e => ({ ...e, context: { ...e.context, modified: true } }))
      );

      const tracker = CoreTracker.getInstance({
        endpoint: 'https://api.example.com/events',
        middlewares: [middleware],
      });

      await (tracker as any).track(event);
      await (tracker as any).tryProcessPendingEvents();

      expect(middleware).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/events',
        expect.objectContaining({
          body: expect.stringContaining('"modified":true'),
        })
      );
    });

    test('handles failed requests with retry', async () => {
      const event: TrackingEvent = {
        id: '1',
        type: 'test',
        timestamp: Date.now(),
        context: {},
        element: { tag: 'button', attributes: {} },
      };

      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });

      const onError = vi.fn();
      const onSuccess = vi.fn();

      const tracker = CoreTracker.getInstance({
        endpoint: 'https://api.example.com/events',
        retryAttempts: 3,
        retryDelay: 1000,
        onError,
        onSuccess,
      });

      await (tracker as any).track(event);
      await (tracker as any).tryProcessPendingEvents();

      // Fast-forward through retries
      await vi.runAllTimersAsync();

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(onSuccess).toHaveBeenCalledWith([event]);
      expect(onError).not.toHaveBeenCalled();
    });

    test('calls error handler after all retries fail', async () => {
      const event: TrackingEvent = {
        id: '1',
        type: 'test',
        timestamp: Date.now(),
        context: {},
        element: { tag: 'button', attributes: {} },
      };

      fetch.mockRejectedValue(new Error('Network error'));

      const onError = vi.fn();
      const onSuccess = vi.fn();

      const tracker = CoreTracker.getInstance({
        endpoint: 'https://api.example.com/events',
        retryAttempts: 2,
        retryDelay: 1000,
        onError,
        onSuccess,
      });

      await (tracker as any).track(event);
      await (tracker as any).tryProcessPendingEvents();

      // Fast-forward through retries
      await vi.runAllTimersAsync();

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.any(Error), [event]);
    });
  });

  describe('middleware handling', () => {
    test('executes multiple middlewares in order', async () => {
      const event: TrackingEvent = {
        id: '1',
        type: 'test',
        timestamp: Date.now(),
        context: {},
        element: { tag: 'button', attributes: {} },
      };

      const middleware1 = vi.fn().mockImplementation(events => 
        events.map(e => ({ ...e, context: { ...e.context, first: true } }))
      );

      const middleware2 = vi.fn().mockImplementation(events => 
        events.map(e => ({ ...e, context: { ...e.context, second: true } }))
      );

      const tracker = CoreTracker.getInstance({
        endpoint: 'https://api.example.com/events',
        middlewares: [middleware1, middleware2],
      });

      await (tracker as any).track(event);
      await (tracker as any).tryProcessPendingEvents();

      expect(middleware1).toHaveBeenCalledBefore(middleware2);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/events',
        expect.objectContaining({
          body: expect.stringContaining('"first":true,"second":true'),
        })
      );
    });

    test('stops processing if middleware throws', async () => {
      const event: TrackingEvent = {
        id: '1',
        type: 'test',
        timestamp: Date.now(),
        context: {},
        element: { tag: 'button', attributes: {} },
      };

      const middleware1 = vi.fn().mockImplementation(() => {
        throw new Error('Middleware error');
      });

      const middleware2 = vi.fn();

      const tracker = CoreTracker.getInstance({
        endpoint: 'https://api.example.com/events',
        middlewares: [middleware1, middleware2],
      });

      await (tracker as any).track(event);
      await expect((tracker as any).tryProcessPendingEvents()).rejects.toThrow();

      expect(middleware2).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});