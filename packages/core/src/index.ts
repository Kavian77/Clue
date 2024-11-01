import { type TrackerOptions, type TrackingEvent, type BatchSize, type Tracker } from './types';
import { StorageManager } from './storage';
import { Logger } from './logger';

export class CoreTracker {
  private static instance: CoreTracker | null = null;
  private events: TrackingEvent[] = [];
  private batchInterval: number;
  private batchSizeKB: BatchSize;
  private globalContext: Record<string, unknown>;
  private batchTimeout: number | null = null;
  private trackers: Map<string, Tracker> = new Map();
  private options: TrackerOptions;
  private storage: StorageManager;
  private isOnline: boolean;
  private retryTimeout: number | null = null;
  private initialized: boolean = false;
  private logger: Logger;
  private processingBatch: boolean = false;
  private visibilityHandler: () => void;

  private constructor(options: TrackerOptions = {}) {
    this.options = options;
    this.batchInterval = options.batchInterval ?? 5000;
    this.batchSizeKB = options.batchSizeKB ?? 500;
    this.globalContext = options.globalContext ?? {};
    this.storage = new StorageManager();
    this.isOnline = navigator.onLine;
    this.logger = new Logger(options.debug ?? false);

    this.visibilityHandler = this.handleVisibilityChange.bind(this);

    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  public static getInstance(options?: TrackerOptions): CoreTracker {
    if (!CoreTracker.instance) {
      CoreTracker.instance = new CoreTracker(options);
    } else if (options) {
      CoreTracker.instance.updateOptions(options);
    }
    return CoreTracker.instance;
  }

  private updateOptions(options: TrackerOptions): void {
    this.options = { ...this.options, ...options };
    this.batchInterval = options.batchInterval ?? this.batchInterval;
    this.batchSizeKB = options.batchSizeKB ?? this.batchSizeKB;
    this.globalContext = { ...this.globalContext, ...options.globalContext };
    this.logger = new Logger(options.debug ?? false);
  }

  public use(TrackerConstructor: new (options: TrackerOptions) => Tracker): this {
    const tracker = new TrackerConstructor({
      ...this.options,
      onBatchDispatch: async (events) => {
        if (!this.initialized) {
          await this.storage.init();
          this.initialized = true;
        }
        await this.track(events[0]);
        return true;
      }
    });
    this.trackers.set(tracker.type, tracker);
    return this;
  }

  private async applyMiddlewares(events: TrackingEvent[]): Promise<TrackingEvent[]> {
    let processedEvents = [...events];
    
    if (this.options.middlewares) {
      for (const middleware of this.options.middlewares) {
        try {
          processedEvents = await Promise.resolve(middleware(processedEvents));
        } catch (error) {
          this.logger.error('Middleware error:', error);
          throw error;
        }
      }
    }
    
    return processedEvents;
  }

  private async sendEvents(events: TrackingEvent[]): Promise<boolean> {
    if (!this.options.endpoint) {
      throw new Error('No endpoint configured for sending events');
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
          method: this.options.method ?? 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.options.headers
          },
          body: JSON.stringify({ events: processedEvents }),
          keepalive: document.visibilityState === 'hidden'
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

        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }

    return false;
  }

  public async start(): Promise<void> {
    if (!this.initialized) {
      await this.storage.init();
      this.initialized = true;
    }

    const pendingEvents = await this.storage.getPendingEvents();
    if (pendingEvents.length > 0) {
      this.logger.group('Startup');
      this.logger.info('Processing stored events from previous session');
      await this.tryProcessPendingEvents();
      this.logger.groupEnd();
    }

    this.startBatchInterval();
    this.trackers.forEach(tracker => tracker.start());
  }

  public stop(): void {
    if (this.batchTimeout) {
      window.clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    if (this.retryTimeout) {
      window.clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.trackers.forEach(tracker => tracker.stop());

    document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  private calculateBatchSize(events: TrackingEvent[]): number {
    return new Blob([JSON.stringify(events)]).size / 1024;
  }

  private getBatchUpToSizeLimit(events: TrackingEvent[]): TrackingEvent[] {
    if (this.batchSizeKB === 'disabled') return events;

    let currentSize = 0;
    let batchEndIndex = events.length;

    if (events.length > 0) {
      const firstEventSize = this.calculateBatchSize([events[0]]);
      if (firstEventSize > this.batchSizeKB) {
        this.logger.warn(`Event size (${firstEventSize.toFixed(2)}KB) exceeds batch limit (${this.batchSizeKB}KB). Processing anyway.`);
        return [events[0]];
      }
      currentSize = firstEventSize;
    }

    for (let i = 1; i < events.length; i++) {
      const eventSize = this.calculateBatchSize([events[i]]);
      if (currentSize + eventSize > this.batchSizeKB) {
        batchEndIndex = i;
        break;
      }
      currentSize += eventSize;
    }

    return events.slice(0, batchEndIndex);
  }

  private async track(event: TrackingEvent): Promise<void> {
    if (!this.initialized) {
      await this.storage.init();
      this.initialized = true;
    }

    const enrichedEvent = {
      ...event,
      context: { ...this.globalContext, ...event.context }
    };

    this.logger.group('Track Event');
    this.logger.debug('Received event:', enrichedEvent);

    await this.storage.storePendingEvents([enrichedEvent]);
    this.logger.info('Event stored in IndexedDB');
    
    this.events.push(enrichedEvent);
    this.logger.info('Event added to memory queue. Queue size:', this.events.length);
    this.logger.groupEnd();
  }

  private startBatchInterval(): void {
    if (this.batchTimeout) {
      window.clearTimeout(this.batchTimeout);
    }

    const processBatch = async () => {
      if (!this.processingBatch && this.initialized) {
        const pendingEvents = await this.storage.getPendingEvents();
        
        if (pendingEvents.length > 0) {
          this.processingBatch = true;
          this.logger.group('Batch Processing');

          try {
            if (this.isOnline) {
              this.logger.debug('Online - processing pending events');
              await this.tryProcessPendingEvents();
            } else {
              this.logger.info('Offline - events stored for later');
            }
          } catch (error) {
            this.logger.error('Batch processing failed:', error);
          } finally {
            this.processingBatch = false;
            this.logger.groupEnd();
          }
        }
      }

      this.batchTimeout = window.setTimeout(processBatch, this.batchInterval);
    };

    this.batchTimeout = window.setTimeout(processBatch, this.batchInterval);
  }

  private async tryProcessPendingEvents(): Promise<void> {
    if (!this.isOnline || !this.initialized) return;

    try {
      const pendingEvents = await this.storage.getPendingEvents();
      if (pendingEvents.length === 0) {
        return;
      }

      this.logger.group('Process Pending Events');
      this.logger.debug('Found pending events:', pendingEvents.length);
      
      let remaining = [...pendingEvents];
      while (remaining.length > 0) {
        const batch = this.getBatchUpToSizeLimit(remaining);
        const success = await this.sendEvents(batch);
        
        if (success) {
          await this.storage.clearPendingEvents(batch);
          this.events = this.events.filter(event => 
            !batch.some(e => e.id === event.id && e.timestamp === event.timestamp)
          );
        }
        
        if (!success || !this.isOnline) {
          this.logger.warn('Stopping batch processing due to failure or offline state');
          break;
        }

        remaining = remaining.slice(batch.length);
      }
      
      this.logger.groupEnd();
    } catch (error) {
      this.logger.error('Failed to process pending events:', error);
      this.retryTimeout = window.setTimeout(
        () => void this.tryProcessPendingEvents(),
        60000
      );
    }
  }

  private handleOnline(): void {
    this.logger.info('Network is online');
    this.isOnline = true;
    void this.tryProcessPendingEvents();
  }

  private handleOffline(): void {
    this.logger.info('Network is offline');
    this.isOnline = false;
    if (this.retryTimeout) {
      window.clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      void this.tryProcessPendingEvents();
    }
  }
}

export * from './types';