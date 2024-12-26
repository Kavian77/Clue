/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, beforeEach, afterEach, it, expect, vi, type Mock } from "vitest";
import { openDB, type IDBPDatabase } from "idb";
import { StorageManager } from "../storage";
import type { TrackingEvent } from "../types";

vi.mock("idb", () => ({
  openDB: vi.fn(),
}));

describe("StorageManager", () => {
  let storageManager: StorageManager;
  let mockDB: IDBPDatabase<any>;
  let mockObjectStore: any;
  let mockTransaction: any;

  const mockEvent: TrackingEvent = {
    id: "123",
    timestamp: Date.now(),
    type: "test",
    context: { foo: "bar" },
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockObjectStore = {
      add: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(),
    };

    mockTransaction = {
      objectStore: vi.fn().mockReturnValue(mockObjectStore),
      done: Promise.resolve(),
    };

    mockDB = {
      transaction: vi.fn().mockReturnValue(mockTransaction),
      createObjectStore: vi.fn(),
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(false),
      },
    } as unknown as IDBPDatabase<any>;

    (openDB as Mock).mockResolvedValue(mockDB);

    storageManager = new StorageManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("init()", () => {
    it("should initialize the database successfully", async () => {
      await expect(storageManager.init()).resolves.toBeUndefined();
      expect(openDB).toHaveBeenCalledTimes(1);
      expect(openDB).toHaveBeenCalledWith(
        "cluesive_tracking",
        1,
        expect.any(Object),
      );
    });

    it("should only initialize once when called multiple times", async () => {
      await storageManager.init();
      await storageManager.init();
      expect(openDB).toHaveBeenCalledTimes(1);
    });

    it("should handle initialization errors", async () => {
      (openDB as Mock).mockRejectedValueOnce(new Error("DB Error"));
      await expect(storageManager.init()).rejects.toThrow("DB Error");
    });
  });

  describe("storePendingEvents()", () => {
    beforeEach(async () => {
      await storageManager.init();
    });

    it("should store events successfully", async () => {
      mockObjectStore.add.mockResolvedValue(undefined);
      await expect(
        storageManager.storePendingEvents([mockEvent]),
      ).resolves.toBeUndefined();
      expect(mockObjectStore.add).toHaveBeenCalledWith(mockEvent);
    });

    it("should fail after max retries", async () => {
      // https://github.com/vitest-dev/vitest/discussions/3689#discussioncomment-8362934
      const rejectSpy = vi.fn();
      mockObjectStore.add.mockRejectedValue(new Error("Transaction failed"));

      storageManager
        .storePendingEvents([mockEvent])
        .catch((err) => rejectSpy(err));

      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(Math.pow(2, i) * 1000);
        await vi.runAllTimersAsync();
      }

      await expect(rejectSpy).toHaveBeenCalledWith(
        new Error("Transaction failed"),
      );
    });
  });

  describe("getPendingEvents()", () => {
    beforeEach(async () => {
      await storageManager.init();
    });

    it("should retrieve all events", async () => {
      mockObjectStore.getAll.mockResolvedValue([mockEvent]);
      await expect(storageManager.getPendingEvents()).resolves.toEqual([
        mockEvent,
      ]);
      expect(mockObjectStore.getAll).toHaveBeenCalledTimes(1);
    });

    it("should handle errors when retrieving events", async () => {
      mockObjectStore.getAll.mockRejectedValue(new Error("Read error"));
      await expect(storageManager.getPendingEvents()).rejects.toThrow(
        "Read error",
      );
    });
  });

  describe("clearPendingEvents()", () => {
    beforeEach(async () => {
      await storageManager.init();
    });

    it("should clear specified events", async () => {
      mockObjectStore.delete.mockResolvedValue(undefined);
      await expect(
        storageManager.clearPendingEvents([mockEvent]),
      ).resolves.toBeUndefined();
      expect(mockObjectStore.delete).toHaveBeenCalledWith([
        mockEvent.id,
        mockEvent.timestamp,
      ]);
    });

    it("should fail after max retries while clearing", async () => {
      // https://github.com/vitest-dev/vitest/discussions/3689#discussioncomment-8362934
      const rejectSpy = vi.fn();
      mockObjectStore.delete.mockRejectedValue(new Error("Transaction failed"));

      storageManager
        .clearPendingEvents([mockEvent])
        .catch((err) => rejectSpy(err));

      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(Math.pow(2, i) * 1000);
        await vi.runAllTimersAsync();
      }

      await expect(rejectSpy).toHaveBeenCalledWith(
        new Error("Transaction failed"),
      );
    });
  });
});
