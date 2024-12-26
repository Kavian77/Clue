import {
  type TrackerOptions,
  type TrackingEvent,
  type BatchSize,
  type Tracker,
  EventDispatcher,
} from "./types";
import { StorageManager } from "./storage";
import { Logger } from "./logger";

const isOnBrowser = typeof window !== "undefined";

export class Cluesive {
  private static instance: Cluesive | null = null;
  private events: TrackingEvent[] = [];
  private syncingInterval: number;
  private maxBatchSizeInKB: BatchSize;
  private globalContext: Record<string, unknown>;
  private batchTimeout: NodeJS.Timeout | null = null;
  private trackers: Map<string, Tracker> = new Map();
  private options: TrackerOptions;
  private storage: StorageManager;
  private isOnline: boolean;
  private isReady: boolean = false;
  private logger: Logger;
  private processingBatch: boolean = false;

  private constructor(options: TrackerOptions = {}) {
    this.options = options;
    this.storage = new StorageManager();
    this.maxBatchSizeInKB = options.maxBatchSizeInKB ?? 500;
    this.logger = new Logger(options.debug ?? false);
    this.globalContext = options.globalContext ?? {};
    this.syncingInterval = options.syncingInterval ?? 5000;
    this.isOnline = isOnBrowser ? navigator.onLine : true;

    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  private addGlobalListeners(): void {
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private removeGlobalListeners(): void {
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );
  }

  private async makeReady(): Promise<void> {
    if (!this.isReady) {
      await this.storage.init();
      this.isReady = true;
    }
  }

  public static init(options?: TrackerOptions): Cluesive {
    if (!Cluesive.instance) {
      Cluesive.instance = new Cluesive(options);
    } else if (options) {
      Cluesive.instance.updateOptions(options);
    }
    return Cluesive.instance;
  }

  public async start(): Promise<void> {
    if (!isOnBrowser) {
      return;
    }

    this.addGlobalListeners();

    await this.makeReady();

    const pendingEvents = await this.storage.getPendingEvents();
    if (pendingEvents.length > 0) {
      this.logger.group("Startup");
      this.logger.info("Processing stored events from previous session");
      await this.tryProcessPendingEvents();
      this.logger.groupEnd();
    }

    this.startBatchInterval();
    this.trackers.forEach((tracker) => tracker.start());
  }

  public stop(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    this.trackers.forEach((tracker) => tracker.stop());

    this.removeGlobalListeners();
  }

  public use(
    TrackerConstructor: new (options: {
      dispatcher: EventDispatcher;
      name?: string;
    }) => Tracker,
    options: { name?: string } = {}
  ): this {
    const tracker = new TrackerConstructor({
      ...options,
      dispatcher: async (event) => {
        await this.makeReady();
        await this.track(event);
      },
    });

    this.trackers.set(tracker.name, tracker);
    return this;
  }

  private updateOptions(options: TrackerOptions): void {
    this.options = { ...this.options, ...options };
    this.syncingInterval = options.syncingInterval ?? this.syncingInterval;
    this.maxBatchSizeInKB = options.maxBatchSizeInKB ?? this.maxBatchSizeInKB;
    this.globalContext = { ...this.globalContext, ...options.globalContext };
    this.logger = new Logger(options.debug ?? false);
  }

  private async applyMiddlewares(
    events: TrackingEvent[]
  ): Promise<TrackingEvent[]> {
    let processedEvents = [...events];

    if (this.options.middlewares) {
      for (const middleware of this.options.middlewares) {
        try {
          processedEvents = await Promise.resolve(middleware(processedEvents));
        } catch (error) {
          this.logger.error("Middleware error:", error);
          throw error;
        }
      }
    }

    return processedEvents;
  }

  private async sendEvents(events: TrackingEvent[]): Promise<boolean> {
    if (!this.options.endpoint) {
      throw new Error("No endpoint configured for sending events");
    }

    const processedEvents = await this.applyMiddlewares(events);
    if (processedEvents.length === 0) {
      return true;
    }
    
    const retryAttempts = this.options.retryAttempts ?? 3;
    const retryDelay = this.options.retryDelay ?? 1000;
    let attempt = 0;
    
    while (attempt < retryAttempts) {
      try {
        const response = await fetch(this.options.endpoint, {
          method: this.options.method ?? "POST",
          headers: {
            "Content-Type": "application/json",
            ...this.options.headers,
          },
          body: JSON.stringify({ events: processedEvents }),
          keepalive: document.visibilityState === "hidden",
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        await this.options.onSuccess?.(processedEvents);
        return true;
      } catch (error) {
        attempt++;
        this.logger.error(`Attempt ${attempt} failed:`, error);

        if (attempt === retryAttempts) {
          await this.options.onError?.(error as Error, processedEvents);
          return false;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, retryDelay * attempt);
        });
      }
    }

    return false;
  }

  private calculateBatchSize(events: TrackingEvent[]): number {
    return new Blob([JSON.stringify(events)]).size / 1024;
  }

  private getBatchUpToSizeLimit(events: TrackingEvent[]): TrackingEvent[] {
    if (this.maxBatchSizeInKB === "disabled") return events;

    let currentSize = 0;
    let batchEndIndex = events.length;

    if (events.length > 0) {
      const firstEventSize = this.calculateBatchSize([events[0]]);
      if (firstEventSize > this.maxBatchSizeInKB) {
        this.logger.warn(
          `Event size (${firstEventSize.toFixed(2)}KB) exceeds batch limit (${
            this.maxBatchSizeInKB
          }KB). Processing anyway.`
        );
        return [events[0]];
      }
      currentSize = firstEventSize;
    }

    for (let i = 1; i < events.length; i++) {
      const eventSize = this.calculateBatchSize([events[i]]);
      if (currentSize + eventSize > this.maxBatchSizeInKB) {
        batchEndIndex = i;
        break;
      }
      currentSize += eventSize;
    }

    return events.slice(0, batchEndIndex);
  }

  private async track(event: TrackingEvent): Promise<void> {
    await this.makeReady();

    const enrichedEvent = {
      ...event,
      context: { ...this.globalContext, ...event.context },
    };

    this.logger.group("Track Event");
    this.logger.debug("Received event:", enrichedEvent);
    await this.storage.storePendingEvents([enrichedEvent]);
    this.logger.info("Event stored in IndexedDB");

    this.events.push(enrichedEvent);
    this.logger.info(
      "Event added to memory queue. Queue size:",
      this.events.length
    );
    this.logger.groupEnd();
  }

  private startBatchInterval(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    const processBatch = async () => {
      if (!this.processingBatch && this.isOnline) {
        await this.makeReady();
        const pendingEvents = await this.storage.getPendingEvents();

        if (pendingEvents.length > 0) {
          this.processingBatch = true;

          try {
            this.logger.debug("Processing pending events");
            await this.tryProcessPendingEvents();
          } catch (error) {
            this.logger.error("Batch processing failed:", error);
          } finally {
            this.processingBatch = false;
          }
        }
      }

      this.batchTimeout = setTimeout(processBatch, this.syncingInterval);
    };

    this.batchTimeout = setTimeout(processBatch, this.syncingInterval);
  }

  private async tryProcessPendingEvents(): Promise<void> {
    if (!this.isOnline) return;
    await this.makeReady();

    try {
      const pendingEvents = await this.storage.getPendingEvents();
      if (pendingEvents.length === 0) {
        return;
      }

      this.logger.group("Process Pending Events");
      this.logger.debug("Found pending events:", pendingEvents.length);

      let remaining = [...pendingEvents];
      while (remaining.length > 0) {
        const batch = this.getBatchUpToSizeLimit(remaining);
        const success = await this.sendEvents(batch);
        if (success) {
          await this.storage.clearPendingEvents(batch);
          const batchIds = new Set(batch.map((e) => e.id));
          this.events = this.events.filter((event) => !batchIds.has(event.id));
        } else {
          this.logger.warn("Stopping batch processing due to failure");
          break;
        }

        if (!this.isOnline) {
          this.logger.warn("Stopping batch processing due to offline state");
          break;
        }

        remaining = remaining.slice(batch.length);
      }

      this.logger.groupEnd();
    } catch (error) {
      this.logger.error("Failed to process pending events:", error);
    }
  }

  private handleOnline() {
    this.logger.info("Network is online");
    this.isOnline = true;
    void this.tryProcessPendingEvents();
  }

  private handleOffline() {
    this.logger.info("Network is offline");
    this.isOnline = false;
  }

  private handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      void this.tryProcessPendingEvents();
    }
  }
}

export * from "./types";
