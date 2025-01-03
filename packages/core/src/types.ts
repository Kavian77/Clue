export type TrackingEvent = {
  id: string;
  type: string;
  timestamp: number;
  context: Record<string, unknown>;
};

export type BatchSize = number | "disabled";

export type EventMiddleware = (
  events: TrackingEvent[],
) => TrackingEvent[] | Promise<TrackingEvent[]>;
export type SuccessHandler = (events: TrackingEvent[]) => void | Promise<void>;
export type ErrorHandler = (
  error: Error,
  events: TrackingEvent[],
) => void | Promise<void>;

export interface TrackerOptions {
  endpoint?: string;
  syncingInterval?: number;
  maxBatchSizeInKB?: BatchSize;
  globalContext?: Record<string, unknown>;
  debug?: boolean;
  middlewares?: EventMiddleware[];
  onSuccess?: SuccessHandler;
  onError?: ErrorHandler;
  headers?: Record<string, string>;
  method?: "POST" | "PUT";
  retryAttempts?: number;
  retryDelay?: number;
}

export interface Tracker {
  start(): void;
  stop(): void;
  name: string;
}

export type EventDispatcher = (event: TrackingEvent) => Promise<void>;
