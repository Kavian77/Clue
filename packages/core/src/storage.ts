import { openDB, DBSchema, IDBPDatabase } from "idb";
import { type TrackingEvent } from "./types";

const DB_NAME = "cluesive_tracking";
const EVENTS_STORE = "pending_events";

interface CluesiveDB extends DBSchema {
  [EVENTS_STORE]: {
    key: [string, number];
    value: TrackingEvent;
  };
}

export class StorageManager {
  private db: IDBPDatabase<CluesiveDB> | null = null;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.db = await openDB<CluesiveDB>(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(EVENTS_STORE)) {
            db.createObjectStore(EVENTS_STORE, {
              keyPath: ["id", "timestamp"],
            });
          }
        },
      });
    })();

    return this.initPromise;
  }

  private getDatabase(): IDBPDatabase<CluesiveDB> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return this.db;
  }

  public async storePendingEvents(events: TrackingEvent[]): Promise<void> {
    await this.ensureConnection();
    const db = this.getDatabase();

    return new Promise((resolve, reject) => {
      const retryOperation = async (attempt: number) => {
        try {
          const tx = db.transaction(EVENTS_STORE, "readwrite");
          const store = tx.objectStore(EVENTS_STORE);

          for (const event of events) {
            try {
              await store.add(event);
            } catch (error) {
              reject(error);
            }
          }

          await tx.done;
          resolve();
        } catch (error) {
          if (attempt < 3) {
            setTimeout(
              () => retryOperation(attempt + 1),
              Math.pow(2, attempt) * 1000,
            );
          } else {
            reject(error);
          }
        }
      };

      retryOperation(0);
    });
  }

  private async ensureConnection(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }

  public async getPendingEvents(): Promise<TrackingEvent[]> {
    await this.ensureConnection();
    const db = this.getDatabase();

    const tx = db.transaction(EVENTS_STORE, "readonly");
    const store = tx.objectStore(EVENTS_STORE);
    const events = await store.getAll();
    await tx.done;
    return events;
  }

  public async clearPendingEvents(events: TrackingEvent[]): Promise<void> {
    await this.ensureConnection();
    const db = this.getDatabase();

    return new Promise((resolve, reject) => {
      const retryOperation = async (attempt: number) => {
        try {
          const tx = db.transaction(EVENTS_STORE, "readwrite");
          const store = tx.objectStore(EVENTS_STORE);

          for (const event of events) {
            try {
              await store.delete([event.id, event.timestamp]);
            } catch (error) {
              reject(error);
              return;
            }
          }

          await tx.done;
          resolve();
        } catch (error) {
          if (attempt < 3) {
            setTimeout(
              () => retryOperation(attempt + 1),
              Math.pow(2, attempt) * 1000,
            );
          } else {
            reject(error);
          }
        }
      };

      retryOperation(0);
    });
  }
}
