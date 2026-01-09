import { FileReceiver } from './receiver';
import { MockWriter, MockReader } from './__mocks__/mock-io';
import { TransferError, MessageType, PartyType, ProtocolVersion, ErrorType } from './types';
import { 
  deserializeMessage, 
  createHelloMessage, 
  createAckMessage, 
  createDataMessage,
  createErrorMessage,
  serializeMessage
} from './protocol';

describe('FileReceiver', () => {
  let writer: MockWriter;
  let reader: MockReader;
  let receiver: FileReceiver;

  beforeEach(() => {
    writer = new MockWriter();
    reader = new MockReader();
    receiver = new FileReceiver(writer, reader, { 
      enableLogging: false,
      chunkSize: 10 
    });
  });

  describe('Initialization', () => {
    it('should create receiver with default options', () => {
      const defaultReceiver = new FileReceiver(writer, reader);
      expect(defaultReceiver).toBeInstanceOf(FileReceiver);
    });

    it('should create receiver with custom options', () => {
      const customReceiver = new FileReceiver(writer, reader, {
        chunkSize: 32,
        sessionIdLength: 8,
        enableLogging: true
      });
      expect(customReceiver).toBeInstanceOf(FileReceiver);
    });
  });

  describe('File Reception', () => {
    it('should handle HELLO message and send ACK', async () => {
      receiver.receive().catch(() => {/* handled */});
      
      // Send HELLO message
      const helloMessage = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        52,
        'text/plain',
        6,
        10
      );
      reader.simulateData(serializeMessage(helloMessage));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have sent ACK
      expect(writer.writtenData.length).toBe(1);
      const ackData = deserializeMessage(writer.getLastWritten()!);
      expect(ackData.messageType).toBe(MessageType.ACK);
      expect(ackData.sessionId).toBe('ABC12');
      
      receiver.cancel();
    });

    it('should handle collision detection', async () => {
      const receivePromise = receiver.receive();
      
      // Send HELLO with RECEIVER party type (collision)
      const helloMessage = createHelloMessage(
        'ABC12',
        100,
        PartyType.RECEIVER, // This should trigger collision detection
        ProtocolVersion.V0,
        'test.txt',
        52,
        'text/plain',
        6,
        10
      );
      reader.simulateData(serializeMessage(helloMessage));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have sent ERROR message
      expect(writer.writtenData.length).toBe(1);
      const errorData = deserializeMessage(writer.getLastWritten()!);
      expect(errorData.messageType).toBe(MessageType.ERROR);
      expect(errorData.errorType).toBe(ErrorType.INVALID_PARTY);
      
      await expect(receivePromise).rejects.toThrow('Another receiver detected');
    });

    it('should complete handshake and start transfer', async () => {
      receiver.receive().catch(() => {/* handled */});
      
      // Send HELLO
      const helloMessage = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        52,
        'text/plain',
        6,
        10
      );
      reader.simulateData(serializeMessage(helloMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send ACK back to complete handshake
      const ackMessage = createAckMessage('ABC12', 200);
      reader.simulateData(serializeMessage(ackMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have sent ACK and PULL
      expect(writer.writtenData.length).toBe(2);
      const pullData = deserializeMessage(writer.getLastWritten()!);
      expect(pullData.messageType).toBe(MessageType.PULL);
      expect(pullData.chunkIndex).toBe(0);
      
      receiver.cancel();
    });

    it('should handle DATA message and request next chunk', async () => {
      receiver.receive().catch(() => {/* handled */});
      
      // Complete handshake
      const helloMessage = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        20,
        'text/plain',
        2,
        10
      );
      reader.simulateData(serializeMessage(helloMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ackMessage = createAckMessage('ABC12', 200);
      reader.simulateData(serializeMessage(ackMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send first chunk
      const chunkData = new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108]); // "Hello Worl"
      const dataMessage = createDataMessage('ABC12', 101, 0, 1, chunkData);
      reader.simulateData(serializeMessage(dataMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have sent ACK, PULL(0), PULL(1)
      expect(writer.writtenData.length).toBe(3);
      const secondPullData = deserializeMessage(writer.getLastWritten()!);
      expect(secondPullData.messageType).toBe(MessageType.PULL);
      expect(secondPullData.chunkIndex).toBe(1);
      
      receiver.cancel();
    });

    it('should complete transfer and return file', async () => {
      const receivePromise = receiver.receive();
      
      // Complete handshake
      const helloMessage = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        12,
        'text/plain',
        2,
        10
      );
      reader.simulateData(serializeMessage(helloMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ackMessage = createAckMessage('ABC12', 200);
      reader.simulateData(serializeMessage(ackMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send first chunk
      const chunk1 = new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108]); // "Hello Worl"
      const dataMessage1 = createDataMessage('ABC12', 101, 0, 1, chunk1);
      reader.simulateData(serializeMessage(dataMessage1));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send second (final) chunk
      const chunk2 = new Uint8Array([100, 33]); // "d!"
      const dataMessage2 = createDataMessage('ABC12', 102, 1, -1, chunk2); // nextChunkIndex = -1 means done
      reader.simulateData(serializeMessage(dataMessage2));
      
      const file = await receivePromise;
      
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('test.txt');
      expect(file.type).toBe('text/plain');
      expect(file.size).toBe(12);
      
      const content = await file.text();
      expect(content).toBe('Hello World!');
    });

    it('should emit handshake event', async () => {
      const handshakeCallback = jest.fn();
      const testReceiver = new FileReceiver(writer, reader, {
        onHandshake: handshakeCallback
      });
      
      testReceiver.receive().catch(() => {/* handled */});
      
      const helloMessage = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        52,
        'text/plain',
        6,
        10
      );
      reader.simulateData(serializeMessage(helloMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handshakeCallback).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'ABC12',
        fileName: 'test.txt',
        fileSize: 52,
        totalChunks: 6
      }));
      
      testReceiver.cancel();
    });

    it('should emit chunk events', async () => {
      const chunkCallback = jest.fn();
      const testReceiver = new FileReceiver(writer, reader, {
        onChunk: chunkCallback
      });
      
      const receivePromise = testReceiver.receive();
      
      // Complete handshake
      const helloMessage = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        10,
        'text/plain',
        1,
        10
      );
      reader.simulateData(serializeMessage(helloMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ackMessage = createAckMessage('ABC12', 200);
      reader.simulateData(serializeMessage(ackMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send chunk
      const chunkData = new Uint8Array([72, 101, 108, 108, 111, 87, 111, 114, 108, 100]); // "HelloWorld" = 10 bytes
      const dataMessage = createDataMessage('ABC12', 101, 0, -1, chunkData);
      reader.simulateData(serializeMessage(dataMessage));
      
      await receivePromise;
      
      expect(chunkCallback).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'ABC12',
        chunkIndex: 0,
        totalChunks: 1
      }));
    });

    it('should handle progress callbacks', async () => {
      const progressCallback = jest.fn();
      
      const receivePromise = receiver.receive({
        onProgress: progressCallback
      });
      
      // Complete handshake and receive a chunk
      const helloMessage = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        10,
        'text/plain',
        1,
        10
      );
      reader.simulateData(serializeMessage(helloMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ackMessage = createAckMessage('ABC12', 200);
      reader.simulateData(serializeMessage(ackMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const chunkData = new Uint8Array([72, 101, 108, 108, 111, 87, 111, 114, 108, 100]); // "HelloWorld" = 10 bytes
      const dataMessage = createDataMessage('ABC12', 101, 0, -1, chunkData);
      reader.simulateData(serializeMessage(dataMessage));
      
      await receivePromise;
      
      expect(progressCallback).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'ABC12',
        fileName: 'test.txt',
        percentComplete: expect.any(Number)
      }));
    });
  });

  describe('Error Handling', () => {
    it('should reject if already receiving', async () => {
      receiver.receive().catch(() => {/* handled */});
      
      await expect(receiver.receive()).rejects.toThrow(TransferError);
      
      receiver.cancel();
    });

    it('should handle ERROR messages', async () => {
      const errorCallback = jest.fn();
      const testReceiver = new FileReceiver(writer, reader, {
        onError: errorCallback
      });
      
      const receivePromise = testReceiver.receive();
      
      const errorMessage = createErrorMessage(ErrorType.INVALID_PARTY);
      reader.simulateData(serializeMessage(errorMessage));
      
      await expect(receivePromise).rejects.toThrow(TransferError);
      expect(errorCallback).toHaveBeenCalled();
    });

    it('should handle reader errors', async () => {
      const errorCallback = jest.fn();
      const testReceiver = new FileReceiver(writer, reader, {
        onError: errorCallback
      });
      
      const receivePromise = testReceiver.receive();
      
      reader.simulateError('Connection lost');
      
      await expect(receivePromise).rejects.toThrow(TransferError);
      expect(errorCallback).toHaveBeenCalled();
    });

    it('should handle session ID mismatch', async () => {
      const receivePromise = receiver.receive();
      
      // Complete handshake
      const helloMessage = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        10,
        'text/plain',
        1,
        10
      );
      reader.simulateData(serializeMessage(helloMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ackMessage = createAckMessage('ABC12', 200);
      reader.simulateData(serializeMessage(ackMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send DATA with wrong session ID
      const chunkData = new Uint8Array([72, 101, 108, 108, 111]);
      const dataMessage = createDataMessage('WRONG', 101, 0, -1, chunkData);
      reader.simulateData(serializeMessage(dataMessage));
      
      await expect(receivePromise).rejects.toThrow(TransferError);
    });

    it('should handle invalid chunk data', async () => {
      const receivePromise = receiver.receive();
      
      // Complete handshake
      const helloMessage = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        10,
        'text/plain',
        1,
        10
      );
      reader.simulateData(serializeMessage(helloMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ackMessage = createAckMessage('ABC12', 200);
      reader.simulateData(serializeMessage(ackMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send invalid chunk (index out of range)
      const dataMessage = createDataMessage('ABC12', 101, 999, -1, new Uint8Array());
      reader.simulateData(serializeMessage(dataMessage));
      
      await expect(receivePromise).rejects.toThrow(TransferError);
    });

    it('should handle file size mismatch', async () => {
      const receivePromise = receiver.receive();
      
      // Complete handshake claiming file size is 20
      const helloMessage = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        20, // Claims 20 bytes
        'text/plain',
        1,
        10
      );
      reader.simulateData(serializeMessage(helloMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ackMessage = createAckMessage('ABC12', 200);
      reader.simulateData(serializeMessage(ackMessage));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send chunk with only 5 bytes
      const chunkData = new Uint8Array([72, 101, 108, 108, 111]);
      const dataMessage = createDataMessage('ABC12', 101, 0, -1, chunkData);
      reader.simulateData(serializeMessage(dataMessage));
      
      await expect(receivePromise).rejects.toThrow(TransferError);
    });

    it('should handle unsupported protocol version', async () => {
      const receivePromise = receiver.receive();
      
      const helloMessage = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        999, // Unsupported version
        'test.txt',
        10,
        'text/plain',
        1,
        10
      );
      reader.simulateData(serializeMessage(helloMessage));
      
      await expect(receivePromise).rejects.toThrow(TransferError);
    });
  });

  describe('Cancellation', () => {
    it('should cancel ongoing reception', async () => {
      const receivePromise = receiver.receive();
      
      receiver.cancel();
      
      await expect(receivePromise).rejects.toThrow(TransferError);
    });

    it('should handle multiple cancel calls', async () => {
      const receivePromise = receiver.receive();
      
      receiver.cancel();
      receiver.cancel(); // Should not throw
      
      await expect(receivePromise).rejects.toThrow(TransferError);
    });
  });
});