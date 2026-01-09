/**
 * File Storage Interface for Resumable Transfers
 * 
 * Provides persistent storage for file chunks to enable resumable sender sessions.
 * When a file is selected for transfer, its chunks are stored in IndexedDB so that
 * transfers can be resumed even after browser refresh or application restart.
 */

export interface StoredFileData {
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  chunks: Uint8Array[];
  createdAt: number;
  lastAccessedAt: number;
}

export interface FileStorageStats {
  totalFiles: number;
  totalSize: number;
  oldestFile: number;
  newestFile: number;
}

/**
 * Interface for persistent file chunk storage
 */
export interface FileStorage {
  /**
   * Store file chunks for a given file
   */
  storeFileChunks(
    fileName: string,
    fileSize: number,
    mimeType: string,
    chunks: Uint8Array[]
  ): Promise<void>;

  /**
   * Retrieve stored file chunks
   */
  getFileChunks(fileName: string): Promise<StoredFileData | null>;

  /**
   * Delete stored file chunks
   */
  deleteFileChunks(fileName: string): Promise<void>;

  /**
   * Get list of all stored file sessions
   */
  getStoredFileSessions(): Promise<string[]>;

  /**
   * Get storage statistics
   */
  getStorageStats(): Promise<FileStorageStats>;

  /**
   * Cleanup old files based on age or storage pressure
   */
  cleanupOldFiles(options?: { maxAgeMs?: number; maxFiles?: number }): Promise<number>;

  /**
   * Check if storage is available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * IndexedDB implementation of FileStorage
 */
export class IndexedFileStorage implements FileStorage {
  private dbName = 'BeamFileStorage';
  private dbVersion = 1;
  private storeName = 'fileChunks';
  private db: IDBDatabase | null = null;

  constructor() { }

  /**
   * Initialize IndexedDB connection
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for file chunks
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'fileName' });

          // Create indexes for efficient querying
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
          store.createIndex('fileSize', 'fileSize', { unique: false });
        }
      };
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (typeof indexedDB === 'undefined') {
        return false;
      }

      await this.initDB();
      return true;
    } catch (error) {
      console.warn('IndexedDB not available:', error);
      return false;
    }
  }

  async storeFileChunks(
    fileName: string,
    fileSize: number,
    mimeType: string,
    chunks: Uint8Array[]
  ): Promise<void> {
    await this.cleanupOldFiles();
    const db = await this.initDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    const now = Date.now();
    const storedData: StoredFileData = {
      fileName,
      fileSize,
      mimeType,
      totalChunks: chunks.length,
      chunkSize: chunks[0]?.length || 0,
      chunks,
      createdAt: now,
      lastAccessedAt: now
    };

    return new Promise((resolve, reject) => {
      const request = store.put(storedData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to store file chunks: ${request.error?.message}`));
    });
  }

  async getFileChunks(fileName: string): Promise<StoredFileData | null> {
    const db = await this.initDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve, reject) => {
      const request = store.get(fileName);

      request.onsuccess = () => {
        const result = request.result as StoredFileData | undefined;

        if (result) {
          // Update last accessed timestamp
          result.lastAccessedAt = Date.now();
          store.put(result);
        }

        resolve(result || null);
      };

      request.onerror = () => reject(new Error(`Failed to get file chunks: ${request.error?.message}`));
    });
  }

  async deleteFileChunks(fileName: string): Promise<void> {
    const db = await this.initDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve, reject) => {
      const request = store.delete(fileName);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete file chunks: ${request.error?.message}`));
    });
  }

  async getStoredFileSessions(): Promise<string[]> {
    const db = await this.initDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve, reject) => {
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(new Error(`Failed to get stored sessions: ${request.error?.message}`));
    });
  }

  async getStorageStats(): Promise<FileStorageStats> {
    const db = await this.initDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result as StoredFileData[];

        if (files.length === 0) {
          resolve({
            totalFiles: 0,
            totalSize: 0,
            oldestFile: 0,
            newestFile: 0
          });
          return;
        }

        const stats: FileStorageStats = {
          totalFiles: files.length,
          totalSize: files.reduce((sum, file) => sum + file.fileSize, 0),
          oldestFile: Math.min(...files.map(f => f.createdAt)),
          newestFile: Math.max(...files.map(f => f.createdAt))
        };

        resolve(stats);
      };

      request.onerror = () => reject(new Error(`Failed to get storage stats: ${request.error?.message}`));
    });
  }

  async cleanupOldFiles(options: { maxAgeMs?: number; maxFiles?: number } = {}): Promise<number> {
    const { maxAgeMs = 7 * 24 * 60 * 60 * 1000, maxFiles = 1 } = options;
    const db = await this.initDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const index = store.index('lastAccessedAt');

    return new Promise((resolve, reject) => {
      const request = index.getAll();

      request.onsuccess = () => {
        const files = request.result as StoredFileData[];
        const now = Date.now();
        const cutoffTime = now - maxAgeMs;

        // Sort by last accessed time (oldest first)
        files.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

        const filesToDelete: string[] = [];

        // Delete files older than maxAge
        for (const file of files) {
          if (file.lastAccessedAt < cutoffTime) {
            filesToDelete.push(file.fileName);
          }
        }

        // If maxFiles is specified, delete oldest files beyond the limit
        if (maxFiles && files.length > maxFiles) {
          const excessFiles = files.slice(0, files.length - maxFiles);
          for (const file of excessFiles) {
            if (!filesToDelete.includes(file.fileName)) {
              filesToDelete.push(file.fileName);
            }
          }
        }

        // Delete the identified files
        let deletedCount = 0;
        let pendingDeletes = filesToDelete.length;

        if (pendingDeletes === 0) {
          resolve(0);
          return;
        }

        for (const fileName of filesToDelete) {
          const deleteRequest = store.delete(fileName);

          deleteRequest.onsuccess = () => {
            deletedCount++;
            pendingDeletes--;
            if (pendingDeletes === 0) {
              resolve(deletedCount);
            }
          };

          deleteRequest.onerror = () => {
            pendingDeletes--;
            if (pendingDeletes === 0) {
              resolve(deletedCount);
            }
          };
        }
      };

      request.onerror = () => reject(new Error(`Failed to cleanup old files: ${request.error?.message}`));
    });
  }
}

/**
 * Default file storage instance
 */
export const defaultFileStorage = new IndexedFileStorage();