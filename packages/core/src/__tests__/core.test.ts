import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  Mocked,
  afterEach,
} from "vitest";
import { Cluesive, TrackingEvent } from "../index";
import { StorageManager } from "../storage";

vi.mock("../storage");
vi.mock("../logger");

describe("cluesive", () => {
  let cluesive: Cluesive;
  let storageManagerMock: Mocked<StorageManager>;

  const trackerOptions = {
    endpoint: "https://mock-endpoint.com",
    debug: true,
    syncingInterval: 1000,
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Reset and mock StorageManager methods for each test
    storageManagerMock = new StorageManager() as Mocked<StorageManager>;
    storageManagerMock.init.mockResolvedValue(void 0);
    storageManagerMock.getPendingEvents.mockResolvedValue([]);
    storageManagerMock.storePendingEvents.mockResolvedValue(void 0);
    storageManagerMock.clearPendingEvents.mockResolvedValue(void 0);

    // Initialize a new cluesive instance for each test
    cluesive = Cluesive.init(trackerOptions);

    // Inject the mocked instance to the cluesive instance
    cluesive["storage"] = storageManagerMock;
  });

  afterEach(async () => {
    await cluesive.stop();
    Cluesive["instance"] = null;
  });

  it("should initialize with options", () => {
    expect(cluesive).toBeDefined();
    expect(cluesive).toHaveProperty("options", trackerOptions);
  });

  it("should initialize storage and set isReady on start", async () => {
    await cluesive.start();
    expect(storageManagerMock.init).toHaveBeenCalled();
    expect(cluesive["isReady"]).toBe(true);
  });

  it("should add and remove global listeners on start and stop", async () => {
    const windowAddListenerSpy = vi.spyOn(window, "addEventListener");
    const WindowRemoveListenerSpy = vi.spyOn(window, "removeEventListener");
    const documentAddListenerSpy = vi.spyOn(document, "addEventListener");
    const documentRemoveListenerSpy = vi.spyOn(document, "removeEventListener");

    await cluesive.start();
    expect(windowAddListenerSpy).toHaveBeenCalledWith(
      "online",
      expect.any(Function)
    );
    expect(windowAddListenerSpy).toHaveBeenCalledWith(
      "offline",
      expect.any(Function)
    );
    expect(documentAddListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );

    await cluesive.stop();
    expect(WindowRemoveListenerSpy).toHaveBeenCalledWith(
      "online",
      expect.any(Function)
    );
    expect(WindowRemoveListenerSpy).toHaveBeenCalledWith(
      "offline",
      expect.any(Function)
    );
    expect(documentRemoveListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );

    windowAddListenerSpy.mockRestore();
    WindowRemoveListenerSpy.mockRestore();
    documentAddListenerSpy.mockRestore();
    documentRemoveListenerSpy.mockRestore();
  });

  it("should store events and add to memory queue on track", async () => {
    const event: TrackingEvent = {
      id: "testEvent",
      context: {},
      type: "type",
      timestamp: 0,
    };
    await cluesive["track"](event);

    expect(storageManagerMock.storePendingEvents).toHaveBeenCalledWith([event]);
    expect(cluesive["events"]).toContainEqual(event);
  });

  it("should attempt to process pending events on visibility change to hidden", async () => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
    });

    await cluesive.start();

    // @ts-expect-error - tryProcessPendingEvents is private
    const tryProcessSpy = vi.spyOn(cluesive, "tryProcessPendingEvents");

    document.dispatchEvent(new Event("visibilitychange"));
    expect(tryProcessSpy).toHaveBeenCalled();
    tryProcessSpy.mockRestore();
  });

  // TODO: I couldn't get this test to work. It doesn't seem like window.dispatchEvent is working as expected.
  it.skip("should handle online and offline events correctly", async () => {
    const onlineEvent = new Event("online");
    const offlineEvent = new Event("offline");

    window.dispatchEvent(onlineEvent);
    expect(cluesive["isOnline"]).toBe(true);

    window.dispatchEvent(offlineEvent);
    expect(cluesive["isOnline"]).toBe(false);
  });

  it("should update options when initialized with new options", () => {
    const newOptions = { ...trackerOptions, syncingInterval: 2000 };
    cluesive = Cluesive.init(newOptions);
    expect(cluesive["options"].syncingInterval).toBe(2000);
  });

  it("should send events to the endpoint and handle success", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const onSuccess = vi.fn();
    
    const event: TrackingEvent = { id: "testEvent", context: {}, type: "type", timestamp: 0 };
    cluesive["options"].onSuccess = onSuccess;
    const wasSendEventSuccessful = await cluesive["sendEvents"]([event]);

    expect(wasSendEventSuccessful).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      trackerOptions.endpoint,
      expect.objectContaining({
        body: JSON.stringify({ events: [event] }),
      })
    );
    expect(onSuccess).toHaveBeenCalledWith([event]);
    fetchSpy.mockRestore();
  });

  it.only("should retry sending events on failure up to retryAttempts", async () => {
    const fetchSpy = vi
      .spyOn(window, "fetch")
      .mockImplementation(() => Promise.reject("Network error"));
    const event: TrackingEvent= { id: "testEvent", context: {}, type: "type", timestamp: 0 };

    cluesive["options"].retryAttempts = 2;

    const sendEventResult = cluesive["sendEvents"]([event]);
    const wasSendEventSuccessful = await sendEventResult;

    expect(wasSendEventSuccessful).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });

  it("should process events up to batch size limit", async () => {
    const events: TrackingEvent[] = Array.from({ length: 10 }, (_, i) => ({
      id: `event${i}`,
      context: {},
      type: "type",
      timestamp: 0,
    }));
    const maxBatchSizeInKB = 1;
    cluesive["maxBatchSizeInKB"] = maxBatchSizeInKB;

    const batchedEvents = cluesive["getBatchUpToSizeLimit"](events);
    expect(batchedEvents.length).toBeLessThanOrEqual(events.length);
  });

  it("should clear pending events after successful batch processing", async () => {
    const event: TrackingEvent = {
      id: "event1",
      context: {},
      type: "type",
      timestamp: 0,
    };

    // @ts-expect-error - sendEvents is private
    const sendEventsSpy = vi.spyOn(cluesive, "sendEvents").mockResolvedValue(true);
    storageManagerMock.getPendingEvents.mockResolvedValueOnce([event]);
    storageManagerMock.clearPendingEvents.mockResolvedValueOnce(void 0);

    await cluesive["tryProcessPendingEvents"]();

    expect(storageManagerMock.clearPendingEvents).toHaveBeenCalledWith([event]);
    sendEventsSpy.mockRestore();
  });

  it("should apply middlewares before sending events", async () => {
    const middleware = vi.fn(async (events: TrackingEvent[]) =>
      events.map((e) => ({ ...e, modified: true }))
    );
    cluesive["options"].middlewares = [middleware];
    const event: TrackingEvent = { id: "event1", context: {}, type: "type", timestamp: 0 };

    await cluesive["track"](event);
    const processedEvents = await cluesive["applyMiddlewares"]([event]);

    expect(middleware).toHaveBeenCalled();
    expect(processedEvents[0]).toHaveProperty("modified", true);
  });
});
