import { z } from 'zod';

export const TrackingEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.number(),
  context: z.record(z.unknown()),
  element: z.object({
    tag: z.string(),
    attributes: z.record(z.string()),
  }),
});

export type TrackingEvent = z.infer<typeof TrackingEventSchema>;
export type BatchSize = number | 'disabled';

export type EventMiddleware = (events: TrackingEvent[]) => TrackingEvent[] | Promise<TrackingEvent[]>;
export type SuccessHandler = (events: TrackingEvent[]) => void | Promise<void>;
export type ErrorHandler = (error: Error, events: TrackingEvent[]) => void | Promise<void>;

export interface TrackerOptions {
  endpoint?: string;
  batchInterval?: number;
  batchSizeKB?: BatchSize;
  globalContext?: Record<string, unknown>;
  debug?: boolean;
  middlewares?: EventMiddleware[];
  onSuccess?: SuccessHandler;
  onError?: ErrorHandler;
  headers?: Record<string, string>;
  method?: 'POST' | 'PUT';
  retryAttempts?: number;
  retryDelay?: number;
}