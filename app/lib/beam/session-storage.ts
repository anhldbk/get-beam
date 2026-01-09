// Session storage for Beam transfers
import { ProgressEvent } from './types';

export interface SessionStorage {
  saveSession(type: 'sender' | 'receiver', session: ProgressEvent): Promise<void>;
  getLastSession(type: 'sender' | 'receiver'): Promise<ProgressEvent | null>;
  clearSessions(type?: 'sender' | 'receiver'): Promise<void>;
}

export class IndexedSessionStorage implements SessionStorage {
  private dbName = 'beam-sessions';
  private dbVersion = 1;
  private storeName = 'sessions';
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          // Create index for efficient queries by type and timestamp
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  private getSessionKey(type: 'sender' | 'receiver', sessionId: string): string {
    return `${type}:${sessionId}`;
  }

  private getLatestSessionKey(type: 'sender' | 'receiver'): string {
    return `latest:${type}`;
  }

  async saveSession(type: 'sender' | 'receiver', session: ProgressEvent): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    const sessionData = {
      key: this.getSessionKey(type, session.sessionId),
      type,
      sessionId: session.sessionId,
      session,
      timestamp: Date.now(),
    };

    const latestData = {
      key: this.getLatestSessionKey(type),
      type: `latest-${type}`,
      sessionId: session.sessionId,
      session,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      // Save the session data
      const sessionRequest = store.put(sessionData);

      sessionRequest.onsuccess = () => {
        // Update the latest session pointer
        const latestRequest = store.put(latestData);

        latestRequest.onsuccess = () => resolve();
        latestRequest.onerror = () => reject(latestRequest.error);
      };

      sessionRequest.onerror = () => reject(sessionRequest.error);
    });
  }

  async getLastSession(type: 'sender' | 'receiver'): Promise<ProgressEvent | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve) => {
      const request = store.get(this.getLatestSessionKey(type));

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.session) {
          resolve(result.session as ProgressEvent);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.warn(`Failed to get last ${type} session:`, request.error);
        resolve(null); // Gracefully degrade instead of throwing
      };
    });
  }

  async clearSessions(type?: 'sender' | 'receiver'): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    if (type) {
      // Clear sessions for specific type
      return new Promise((resolve, reject) => {
        const index = store.index('type');
        const request = index.openCursor(IDBKeyRange.only(type));

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            // Also clear the latest pointer
            const latestRequest = store.delete(this.getLatestSessionKey(type));
            latestRequest.onsuccess = () => resolve();
            latestRequest.onerror = () => reject(latestRequest.error);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } else {
      // Clear all sessions
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getAllSessions(type: 'sender' | 'receiver'): Promise<ProgressEvent[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve) => {
      const sessions: ProgressEvent[] = [];
      const index = store.index('type');
      const request = index.openCursor(IDBKeyRange.only(type));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const data = cursor.value;
          if (data.session && data.sessionId) {
            sessions.push(data.session as ProgressEvent);
          }
          cursor.continue();
        } else {
          // Sort by timestamp, most recent first
          sessions.sort((a, b) => b.estimatedTimeRemaining - a.estimatedTimeRemaining);
          resolve(sessions);
        }
      };

      request.onerror = () => {
        console.warn(`Failed to get all ${type} sessions:`, request.error);
        resolve([]); // Gracefully degrade
      };
    });
  }
}

// Create a singleton instance for the app
let storageInstance: IndexedSessionStorage | null = null;

function getSessionStorageInstance(): IndexedSessionStorage {
  if (!storageInstance) {
    storageInstance = new IndexedSessionStorage();
  }
  return storageInstance;
}

// Convenience functions for easy access
export async function getLastSenderSession(): Promise<ProgressEvent | null> {
  const storage = getSessionStorageInstance();
  return storage.getLastSession('sender');
}

export async function getLastReceiverSession(): Promise<ProgressEvent | null> {
  const storage = getSessionStorageInstance();
  return storage.getLastSession('receiver');
}

export async function saveSenderSession(session: ProgressEvent): Promise<void> {
  const storage = getSessionStorageInstance();

  // Clear any existing sender sessions to keep only the last one
  await storage.clearSessions('sender');

  return storage.saveSession('sender', session);
}

export async function saveReceiverSession(session: ProgressEvent): Promise<void> {
  const storage = getSessionStorageInstance();
  return storage.saveSession('receiver', session);
}

export async function clearSenderSessions(): Promise<void> {
  const storage = getSessionStorageInstance();
  return storage.clearSessions('sender');
}

export async function clearReceiverSessions(): Promise<void> {
  const storage = getSessionStorageInstance();
  return storage.clearSessions('receiver');
}

export async function clearAllSessions(): Promise<void> {
  const storage = getSessionStorageInstance();
  return storage.clearSessions();
}

// Note: IndexedSessionStorage is already exported above