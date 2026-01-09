/**
 * @jest-environment jsdom
 */

import 'fake-indexeddb/auto';
import { IndexedFileStorage } from './file-storage';

// Polyfill for structuredClone in older Node.js environments
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
}

describe('IndexedFileStorage - Core Functionality', () => {
  let storage: IndexedFileStorage;

  beforeEach(async () => {
    // Use unique database names for each test to ensure isolation
    const uniqueDbName = `BeamFileStorage_${Date.now()}_${Math.random()}`;
    storage = new (class extends IndexedFileStorage {
      constructor() {
        super();
        // Access private property through bracket notation for testing
        (this as Record<string, unknown>).dbName = uniqueDbName;
      }
    })();
  });

  const testFileName = 'test-file.txt';
  const testFileSize = 1024;
  const testMimeType = 'text/plain';
  const testChunks = [
    new Uint8Array([1, 2, 3, 4]),
    new Uint8Array([5, 6, 7, 8]),
    new Uint8Array([9, 10, 11, 12])
  ];

  test('should be available when IndexedDB is supported', async () => {
    const available = await storage.isAvailable();
    expect(available).toBe(true);
  });

  test('should store and retrieve file chunks', async () => {
    // Store chunks
    await storage.storeFileChunks(testFileName, testFileSize, testMimeType, testChunks);

    // Retrieve chunks
    const retrieved = await storage.getFileChunks(testFileName);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.fileName).toBe(testFileName);
    expect(retrieved!.fileSize).toBe(testFileSize);
    expect(retrieved!.mimeType).toBe(testMimeType);
    expect(retrieved!.totalChunks).toBe(testChunks.length);
    expect(retrieved!.chunks).toHaveLength(testChunks.length);
  });

  test('should return null for non-existent files', async () => {
    const result = await storage.getFileChunks('non-existent-file.txt');
    expect(result).toBeNull();
  });

  test('should delete file chunks successfully', async () => {
    // Store chunks
    await storage.storeFileChunks(testFileName, testFileSize, testMimeType, testChunks);

    // Verify file exists
    let retrieved = await storage.getFileChunks(testFileName);
    expect(retrieved).not.toBeNull();

    // Delete the file
    await storage.deleteFileChunks(testFileName);

    // Verify file is gone
    retrieved = await storage.getFileChunks(testFileName);
    expect(retrieved).toBeNull();
  });

  test('should list stored file sessions', async () => {
    // Initially empty
    let sessions = await storage.getStoredFileSessions();
    expect(sessions).toEqual([]);

    // Add some files
    await storage.storeFileChunks('file1.txt', 100, 'text/plain', [new Uint8Array([1, 2])]);
    await storage.storeFileChunks('file2.txt', 200, 'text/plain', [new Uint8Array([3, 4])]);

    sessions = await storage.getStoredFileSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions).toContain('file1.txt');
    expect(sessions).toContain('file2.txt');
  });

  test('should calculate storage statistics', async () => {
    // Empty storage
    let stats = await storage.getStorageStats();
    expect(stats.totalFiles).toBe(0);
    expect(stats.totalSize).toBe(0);

    // Add files
    await storage.storeFileChunks('file1.txt', 100, 'text/plain', [new Uint8Array([1, 2])]);
    await storage.storeFileChunks('file2.txt', 200, 'text/plain', [new Uint8Array([3, 4])]);

    stats = await storage.getStorageStats();
    expect(stats.totalFiles).toBe(2);
    expect(stats.totalSize).toBe(300);
    expect(stats.oldestFile).toBeGreaterThan(0);
    expect(stats.newestFile).toBeGreaterThan(0);
  });

  test('should handle empty chunks array', async () => {
    await storage.storeFileChunks('empty.txt', 0, 'text/plain', []);

    const retrieved = await storage.getFileChunks('empty.txt');
    expect(retrieved!.totalChunks).toBe(0);
    expect(retrieved!.chunkSize).toBe(0);
  });
});