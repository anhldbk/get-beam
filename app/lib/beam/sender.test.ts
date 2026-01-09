import { FileSender } from './sender';
import { MockWriter, MockReader } from './__mocks__/mock-io';
import { TransferError, MessageType } from './types';
import { deserializeMessage, createAckMessage, createPullMessage, createErrorMessage, serializeMessage } from './protocol';

describe('FileSender', () => {
  let writer: MockWriter;
  let reader: MockReader;
  let sender: FileSender;
  let testFile: File;

  beforeEach(() => {
    writer = new MockWriter();
    reader = new MockReader();
    sender = new FileSender(writer, reader, { 
      enableLogging: false,
      chunkSize: 10 
    });
    
    const content = 'Hello World! This is test content for file transfer.';
    testFile = new File([content], 'test.txt', { type: 'text/plain' });
  });

  describe('Initialization', () => {
    it('should create sender with default options', () => {
      const defaultSender = new FileSender(writer, reader);
      expect(defaultSender).toBeInstanceOf(FileSender);
    });

    it('should create sender with custom options', () => {
      const customSender = new FileSender(writer, reader, {
        chunkSize: 32,
        sessionIdLength: 8,
        enableLogging: true
      });
      expect(customSender).toBeInstanceOf(FileSender);
    });
  });

  describe('File Sending', () => {
    it('should send HELLO message on start', async () => {
      sender.send(testFile).catch(() => {/* handled */});
      
      // Wait a bit for the HELLO message to be sent
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(writer.writtenData.length).toBe(1);
      
      const helloData = deserializeMessage(writer.getLastWritten()!);
      expect(helloData.messageType).toBe(MessageType.HELLO);
      expect(helloData.fileName).toBe('test.txt');
      expect(helloData.fileSize).toBe(testFile.size);
      
      // Cancel to avoid hanging test
      sender.cancel();
    });

    it('should handle ACK message and move to transfer state', async () => {
      sender.send(testFile).catch(() => {/* handled */});
      
      // Wait for HELLO message
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Get session ID from HELLO message
      const helloData = deserializeMessage(writer.getLastWritten()!);
      const sessionId = helloData[1] as string;
      
      // Simulate ACK response
      const ackMessage = createAckMessage(sessionId, 200);
      reader.simulateData(serializeMessage(ackMessage));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have sent HELLO and response ACK
      expect(writer.writtenData.length).toBe(2);
      
      sender.cancel();
    });

    it('should handle PULL message and send DATA', async () => {
      sender.send(testFile).catch(() => {/* handled */});
      
      // Wait for HELLO
      await new Promise(resolve => setTimeout(resolve, 10));
      const helloData = deserializeMessage(writer.getLastWritten()!);
      const sessionId = helloData[1] as string;
      
      // Send ACK
      const ackMessage = createAckMessage(sessionId, 200);
      reader.simulateData(serializeMessage(ackMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send PULL for chunk 0
      const pullMessage = createPullMessage(sessionId, 201, 0);
      reader.simulateData(serializeMessage(pullMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have sent HELLO, ACK, and DATA
      expect(writer.writtenData.length).toBe(3);
      
      const dataMessage = deserializeMessage(writer.getLastWritten()!);
      expect(dataMessage.messageType).toBe(MessageType.DATA);
      expect(dataMessage.chunkIndex).toBe(0);
      
      sender.cancel();
    });

    it('should emit handshake event', async () => {
      const handshakeCallback = jest.fn();
      const testSender = new FileSender(writer, reader, {
        onHandshake: handshakeCallback
      });
      
      testSender.send(testFile).catch(() => {/* handled */});
      
      // Wait for HELLO
      await new Promise(resolve => setTimeout(resolve, 10));
      const helloData = deserializeMessage(writer.getLastWritten()!);
      const sessionId = helloData[1] as string;
      
      // Send ACK
      const ackMessage = createAckMessage(sessionId, 200);
      reader.simulateData(serializeMessage(ackMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handshakeCallback).toHaveBeenCalledWith(expect.objectContaining({
        sessionId,
        fileName: 'test.txt',
        fileSize: testFile.size
      }));
      
      testSender.cancel();
    });

    it('should emit chunk events', async () => {
      const chunkCallback = jest.fn();
      const testSender = new FileSender(writer, reader, {
        onChunk: chunkCallback,
        chunkSize: 10
      });
      
      testSender.send(testFile).catch(() => {/* handled */});
      
      // Complete handshake
      await new Promise(resolve => setTimeout(resolve, 10));
      const helloData = deserializeMessage(writer.getLastWritten()!);
      const sessionId = helloData[1] as string;
      
      const ackMessage = createAckMessage(sessionId, 200);
      reader.simulateData(serializeMessage(ackMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Request first chunk
      const pullMessage = createPullMessage(sessionId, 201, 0);
      reader.simulateData(serializeMessage(pullMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(chunkCallback).toHaveBeenCalledWith(expect.objectContaining({
        sessionId,
        chunkIndex: 0
      }));
      
      testSender.cancel();
    });

    it('should handle progress callbacks', async () => {
      const progressCallback = jest.fn();
      
      sender.send(testFile, {
        onProgress: progressCallback
      }).catch(() => {/* handled */});
      
      // Complete handshake and send a chunk
      await new Promise(resolve => setTimeout(resolve, 10));
      const helloData = deserializeMessage(writer.getLastWritten()!);
      const sessionId = helloData[1] as string;
      
      const ackMessage = createAckMessage(sessionId, 200);
      reader.simulateData(serializeMessage(ackMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const pullMessage = createPullMessage(sessionId, 201, 0);
      reader.simulateData(serializeMessage(pullMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(progressCallback).toHaveBeenCalledWith(expect.objectContaining({
        sessionId,
        fileName: 'test.txt',
        percentComplete: expect.any(Number)
      }));
      
      sender.cancel();
    });
  });

  describe('Error Handling', () => {
    it('should reject if already sending', async () => {
      sender.send(testFile).catch(() => {/* handled */});
      
      await expect(sender.send(testFile)).rejects.toThrow(TransferError);
      
      sender.cancel();
    });

    it('should handle ERROR messages', async () => {
      const errorCallback = jest.fn();
      const testSender = new FileSender(writer, reader, {
        onError: errorCallback
      });
      
      testSender.send(testFile).catch(() => {/* handled */});
      
      // Send error message
      const errorMessage = createErrorMessage(0);
      reader.simulateData(serializeMessage(errorMessage));
      
      await expect(sendPromise).rejects.toThrow(TransferError);
      expect(errorCallback).toHaveBeenCalled();
    });

    it('should handle reader errors', async () => {
      const errorCallback = jest.fn();
      const testSender = new FileSender(writer, reader, {
        onError: errorCallback
      });
      
      testSender.send(testFile).catch(() => {/* handled */});
      
      // Simulate reader error
      reader.simulateError('Connection lost');
      
      await expect(sendPromise).rejects.toThrow(TransferError);
      expect(errorCallback).toHaveBeenCalled();
    });

    it('should handle session ID mismatch', async () => {
      sender.send(testFile).catch(() => {/* handled */});
      
      // Wait for HELLO
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send ACK with wrong session ID
      const ackMessage = createAckMessage('WRONG', 200);
      reader.simulateData(serializeMessage(ackMessage));
      
      await expect(sendPromise).rejects.toThrow(TransferError);
    });

    it('should handle invalid message format', async () => {
      sender.send(testFile).catch(() => {/* handled */});
      
      // Send invalid data
      reader.simulateData('invalid-data');
      
      await expect(sendPromise).rejects.toThrow(TransferError);
    });
  });

  describe('Cancellation', () => {
    it('should cancel ongoing transfer', async () => {
      sender.send(testFile).catch(() => {/* handled */});
      
      sender.cancel();
      
      await expect(sendPromise).rejects.toThrow(TransferError);
    });

    it('should handle multiple cancel calls', async () => {
      sender.send(testFile).catch(() => {/* handled */});
      
      sender.cancel();
      sender.cancel(); // Should not throw
      
      await expect(sendPromise).rejects.toThrow(TransferError);
    });
  });
});