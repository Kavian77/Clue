import { type TrackingEvent } from './types';

const DB_NAME = 'piq_tracking';
const EVENTS_STORE = 'pending_events';

export class StorageManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      try {
        const checkRequest = indexedDB.open(DB_NAME);
        
        checkRequest.onsuccess = () => {
          const currentVersion = checkRequest.result.version;
          checkRequest.result.close();
          
          const request = indexedDB.open(DB_NAME, currentVersion + 1);

          request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            reject(new Error('Failed to open IndexedDB'));
          };

          request.onsuccess = () => {
            this.db = request.result;
            resolve();
          };

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            
            if (!db.objectStoreNames.contains(EVENTS_STORE)) {
              db.createObjectStore(EVENTS_STORE, { 
                keyPath: ['id', 'timestamp']
              });
            }
          };
        };

        checkRequest.onerror = () => {
          const request = indexedDB.open(DB_NAME, 1);

          request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            reject(new Error('Failed to open IndexedDB'));
          };

          request.onsuccess = () => {
            this.db = request.result;
            resolve();
          };

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            db.createObjectStore(EVENTS_STORE, { 
              keyPath: ['id', 'timestamp']
            });
          };
        };
      } catch (error) {
        console.error('Error initializing IndexedDB:', error);
        reject(error);
      }
    });

    return this.initPromise;
  }

  private getDatabase(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  public async storePendingEvents(events: TrackingEvent[]): Promise<void> {
    await this.ensureConnection();
    const db = this.getDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(EVENTS_STORE, 'readwrite');
        const store = transaction.objectStore(EVENTS_STORE);

        transaction.onerror = () => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        transaction.oncomplete = () => {
          resolve();
        };

        events.forEach(event => {
          try {
            store.add(event);
          } catch (error) {
            console.error('Error adding event to store:', error);
          }
        });
      } catch (error) {
        console.error('Error creating transaction:', error);
        reject(error);
      }
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

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(EVENTS_STORE, 'readonly');
        const store = transaction.objectStore(EVENTS_STORE);
        const request = store.getAll();

        request.onerror = () => {
          console.error('Error getting pending events:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve(request.result);
        };
      } catch (error) {
        console.error('Error reading from IndexedDB:', error);
        reject(error);
      }
    });
  }

  public async clearPendingEvents(events: TrackingEvent[]): Promise<void> {
    await this.ensureConnection();
    const db = this.getDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(EVENTS_STORE, 'readwrite');
        const store = transaction.objectStore(EVENTS_STORE);

        transaction.onerror = () => {
          console.error('Transaction error while clearing:', transaction.error);
          reject(transaction.error);
        };

        transaction.oncomplete = () => {
          resolve();
        };

        events.forEach(event => {
          try {
            store.delete([event.id, event.timestamp]);
          } catch (error) {
            console.error('Error deleting event from store:', error);
          }
        });
      } catch (error) {
        console.error('Error creating transaction:', error);
        reject(error);
      }
    });
  }
}