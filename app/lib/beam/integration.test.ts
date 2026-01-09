import { FileSender } from './sender';
import { FileReceiver } from './receiver';
import { MockChannel } from './__mocks__/mock-io';
import { TransferError, ProgressEvent } from './types';

describe('Beam Integration Tests', () => {
  let channel: MockChannel;
  let sender: FileSender;
  let receiver: FileReceiver;

  beforeEach(() => {
    channel = new MockChannel();
    const senderIO = channel.getSenderIO();
    const receiverIO = channel.getReceiverIO();

    sender = new FileSender(senderIO.writer, senderIO.reader, {
      enableLogging: false,
      chunkSize: 10
    });

    receiver = new FileReceiver(receiverIO.writer, receiverIO.reader, {
      enableLogging: false,
      chunkSize: 10
    });
  });

  afterEach(() => {
    channel.clear();
  });

  describe('Full Transfer Flow', () => {
    it('should complete full file transfer successfully', async () => {
      const originalContent = 'Hello World! This is a test file for Beam transfer.';
      const originalFile = new File([originalContent], 'test.txt', { type: 'text/plain' });

      // Start both sender and receiver
      const receivePromise = receiver.receive();
      const sendPromise = sender.send(originalFile);

      // Wait for both to complete
      const [receivedFile] = await Promise.all([receivePromise, sendPromise]);

      // Verify the received file
      expect(receivedFile).toBeInstanceOf(File);
      expect(receivedFile.name).toBe('test.txt');
      expect(receivedFile.type).toBe('text/plain');
      expect(receivedFile.size).toBe(originalFile.size);

      const receivedContent = await receivedFile.text();
      expect(receivedContent).toBe(originalContent);
    });

    it('should handle empty file transfer', async () => {
      const originalFile = new File([], 'empty.txt', { type: 'text/plain' });

      const receivePromise = receiver.receive();
      const sendPromise = sender.send(originalFile);

      const [receivedFile] = await Promise.all([receivePromise, sendPromise]);

      expect(receivedFile.name).toBe('empty.txt');
      expect(receivedFile.size).toBe(0);
    });

    it('should handle large file transfer with multiple chunks', async () => {
      // Create a larger file that will require multiple chunks
      const content = 'A'.repeat(250); // 250 chars with chunk size 10 = 25 chunks
      const originalFile = new File([content], 'large.txt', { type: 'text/plain' });

      const receivePromise = receiver.receive();
      const sendPromise = sender.send(originalFile);

      const [receivedFile] = await Promise.all([receivePromise, sendPromise]);

      expect(receivedFile.name).toBe('large.txt');
      expect(receivedFile.size).toBe(250);

      const receivedContent = await receivedFile.text();
      expect(receivedContent).toBe(content);
    });

    it('should handle binary file transfer', async () => {
      // Create binary data
      const binaryData = new Uint8Array([0, 1, 2, 3, 255, 254, 253, 252, 128, 127]);
      const originalFile = new File([binaryData], 'binary.bin', { type: 'application/octet-stream' });

      const receivePromise = receiver.receive();
      const sendPromise = sender.send(originalFile);

      const [receivedFile] = await Promise.all([receivePromise, sendPromise]);

      expect(receivedFile.name).toBe('binary.bin');
      expect(receivedFile.type).toBe('application/octet-stream');
      expect(receivedFile.size).toBe(binaryData.length);

      const receivedData = new Uint8Array(await receivedFile.arrayBuffer());
      expect(receivedData).toEqual(binaryData);
    });

    it('should emit progress events during transfer', async () => {
      const content = 'A'.repeat(100); // 100 chars = 10 chunks
      const originalFile = new File([content], 'progress.txt', { type: 'text/plain' });

      const senderProgress: ProgressEvent[] = [];
      const receiverProgress: ProgressEvent[] = [];

      const receivePromise = receiver.receive({
        onProgress: (progress) => receiverProgress.push(progress)
      });

      const sendPromise = sender.send(originalFile, {
        onProgress: (progress) => senderProgress.push(progress)
      });

      await Promise.all([receivePromise, sendPromise]);

      // Should have progress events
      expect(senderProgress.length).toBeGreaterThan(0);
      expect(receiverProgress.length).toBeGreaterThan(0);

      // Progress should increase
      const lastSenderProgress = senderProgress[senderProgress.length - 1];
      const lastReceiverProgress = receiverProgress[receiverProgress.length - 1];

      expect(lastSenderProgress.percentComplete).toBeGreaterThan(0);
      expect(lastReceiverProgress.percentComplete).toBeGreaterThan(0);
    });

    it('should emit event callbacks during transfer', async () => {
      const content = 'Hello World!';
      const originalFile = new File([content], 'events.txt', { type: 'text/plain' });

      const senderEvents = {
        handshake: jest.fn(),
        chunk: jest.fn(),
        done: jest.fn(),
        error: jest.fn()
      };

      const receiverEvents = {
        handshake: jest.fn(),
        chunk: jest.fn(),
        done: jest.fn(),
        error: jest.fn()
      };

      const senderWithEvents = new FileSender(channel.getSenderIO().writer, channel.getSenderIO().reader, {
        onHandshake: senderEvents.handshake,
        onChunk: senderEvents.chunk,
        onDone: senderEvents.done,
        onError: senderEvents.error
      });

      const receiverWithEvents = new FileReceiver(channel.getReceiverIO().writer, channel.getReceiverIO().reader, {
        onHandshake: receiverEvents.handshake,
        onChunk: receiverEvents.chunk,
        onDone: receiverEvents.done,
        onError: receiverEvents.error
      });

      const receivePromise = receiverWithEvents.receive();
      const sendPromise = senderWithEvents.send(originalFile);

      await Promise.all([receivePromise, sendPromise]);

      // Verify events were called
      expect(senderEvents.handshake).toHaveBeenCalled();
      expect(senderEvents.chunk).toHaveBeenCalled();
      expect(senderEvents.done).toHaveBeenCalled();
      expect(senderEvents.error).not.toHaveBeenCalled();

      expect(receiverEvents.handshake).toHaveBeenCalled();
      expect(receiverEvents.chunk).toHaveBeenCalled();
      expect(receiverEvents.done).toHaveBeenCalled();
      expect(receiverEvents.error).not.toHaveBeenCalled();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle cancellation during transfer', async () => {
      const content = 'A'.repeat(1000); // Large file to ensure time for cancellation
      const originalFile = new File([content], 'cancel.txt', { type: 'text/plain' });

      const receivePromise = receiver.receive();
      const sendPromise = sender.send(originalFile);

      // Cancel immediately
      await sender.cancel();
      await receiver.cancel();

      await expect(Promise.all([receivePromise, sendPromise])).rejects.toThrow(TransferError);
    });

    it('should handle collision when two receivers try to connect', async () => {
      // Create two receivers
      const receiver2IO = channel.getReceiverIO();
      const receiver2 = new FileReceiver(receiver2IO.writer, receiver2IO.reader);

      const receivePromise1 = receiver.receive();
      const receivePromise2 = receiver2.receive();

      // Try to send HELLO to both (this simulates two receivers scanning the same QR)
      const content = 'Hello';
      const file = new File([content], 'collision.txt');

      // This should cause a collision
      const sendPromise = sender.send(file);

      // One or both should fail due to collision
      await expect(
        Promise.all([receivePromise1, receivePromise2, sendPromise])
      ).rejects.toThrow();
    });
  });

  describe('Different Chunk Sizes', () => {
    it('should work with very small chunk size', async () => {
      const senderSmall = new FileSender(channel.getSenderIO().writer, channel.getSenderIO().reader, {
        chunkSize: 1
      });
      const receiverSmall = new FileReceiver(channel.getReceiverIO().writer, channel.getReceiverIO().reader, {
        chunkSize: 1
      });

      const content = 'ABC';
      const file = new File([content], 'small-chunks.txt');

      const receivePromise = receiverSmall.receive();
      const sendPromise = senderSmall.send(file);

      const [receivedFile] = await Promise.all([receivePromise, sendPromise]);

      const receivedContent = await receivedFile.text();
      expect(receivedContent).toBe(content);
    });

    it('should work with large chunk size', async () => {
      const senderLarge = new FileSender(channel.getSenderIO().writer, channel.getSenderIO().reader, {
        chunkSize: 1024
      });
      const receiverLarge = new FileReceiver(channel.getReceiverIO().writer, channel.getReceiverIO().reader, {
        chunkSize: 1024
      });

      const content = 'Hello World!';
      const file = new File([content], 'large-chunks.txt');

      const receivePromise = receiverLarge.receive();
      const sendPromise = senderLarge.send(file);

      const [receivedFile] = await Promise.all([receivePromise, sendPromise]);

      const receivedContent = await receivedFile.text();
      expect(receivedContent).toBe(content);
    });
  });
});