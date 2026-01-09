import {
  serializeMessage,
  deserializeMessage,
  validateMessage,
  createHelloMessage,
  createAckMessage,
  createPullMessage,
  createDataMessage,
  createErrorMessage,
  generateSessionId,
  chunkFile,
  assembleFile
} from './protocol';

import {
  MessageType,
  PartyType,
  ProtocolVersion,
  ErrorType,
  TransferError
} from './types';

describe('Protocol', () => {
  describe('Message Serialization', () => {
    it('should serialize and deserialize HELLO message', () => {
      const message = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        1024,
        'text/plain',
        16,
        64
      );

      const serialized = serializeMessage(message);
      expect(typeof serialized).toBe('string');

      const deserialized = deserializeMessage(serialized);
      expect(deserialized).toEqual(message);
    });

    it('should serialize and deserialize ACK message', () => {
      const message = createAckMessage('ABC12', 101);
      
      const serialized = serializeMessage(message);
      const deserialized = deserializeMessage(serialized);
      
      expect(deserialized).toEqual(message);
    });

    it('should serialize and deserialize PULL message', () => {
      const message = createPullMessage('ABC12', 102, 5);
      
      const serialized = serializeMessage(message);
      const deserialized = deserializeMessage(serialized);
      
      expect(deserialized).toEqual(message);
    });

    it('should serialize and deserialize DATA message', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const message = createDataMessage('ABC12', 103, 5, 6, data);
      
      const serialized = serializeMessage(message);
      const deserialized = deserializeMessage(serialized);
      
      expect(deserialized).toEqual(message);
    });

    it('should serialize and deserialize ERROR message', () => {
      const message = createErrorMessage(ErrorType.INVALID_PARTY);
      
      const serialized = serializeMessage(message);
      const deserialized = deserializeMessage(serialized);
      
      expect(deserialized).toEqual(message);
    });

    it('should throw error for invalid serialization', () => {
      expect(() => {
        // @ts-expect-error Testing invalid input
        serializeMessage(null);
      }).toThrow(TransferError);
    });

    it('should throw error for invalid deserialization', () => {
      expect(() => {
        deserializeMessage('invalid-base64');
      }).toThrow(TransferError);
    });
  });

  describe('Message Validation', () => {
    it('should validate correct HELLO message', () => {
      const message = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        1024,
        'text/plain',
        16,
        64
      );

      expect(() => validateMessage(message, MessageType.HELLO)).not.toThrow();
    });

    it('should reject non-array message', () => {
      expect(() => {
        validateMessage('not an array', MessageType.HELLO);
      }).toThrow(TransferError);
    });

    it('should reject message with wrong type', () => {
      const message = createAckMessage('ABC12', 100);
      
      expect(() => {
        validateMessage(message, MessageType.HELLO);
      }).toThrow(TransferError);
    });

    it('should reject HELLO message with wrong field count', () => {
      const invalidMessage = [MessageType.HELLO, 'ABC12']; // Too few fields
      
      expect(() => {
        validateMessage(invalidMessage, MessageType.HELLO);
      }).toThrow(TransferError);
    });

    it('should reject ACK message with wrong field count', () => {
      const invalidMessage = [MessageType.ACK]; // Too few fields
      
      expect(() => {
        validateMessage(invalidMessage, MessageType.ACK);
      }).toThrow(TransferError);
    });
  });

  describe('Session ID Generation', () => {
    it('should generate session ID of correct length', () => {
      const sessionId = generateSessionId('test.txt', 5);
      expect(sessionId).toHaveLength(5);
      expect(sessionId).toMatch(/^[A-Z0-9]+$/);
    });

    it('should generate different IDs for different file names', () => {
      const id1 = generateSessionId('file1.txt', 5);
      const id2 = generateSessionId('file2.txt', 5);
      expect(id1).not.toBe(id2);
    });

    it('should generate same ID for same file name', () => {
      const id1 = generateSessionId('test.txt', 5);
      const id2 = generateSessionId('test.txt', 5);
      expect(id1).toBe(id2);
    });

    it('should use default length when not specified', () => {
      const sessionId = generateSessionId('test.txt');
      expect(sessionId).toHaveLength(5);
    });
  });

  describe('File Chunking', () => {
    it('should chunk file correctly', async () => {
      const content = 'Hello World! This is a test file.';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const chunks = await chunkFile(file, 10);

      expect(chunks.length).toBe(4); // 33 chars / 10 = 4 chunks
      expect(chunks[0]).toEqual(new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108])); // "Hello Worl"
      expect(chunks[3]).toEqual(new Uint8Array([108, 101, 46])); // "le."
    });

    it('should handle empty file', async () => {
      const file = new File([], 'empty.txt', { type: 'text/plain' });
      const chunks = await chunkFile(file, 10);

      expect(chunks.length).toBe(0);
    });

    it('should handle file smaller than chunk size', async () => {
      const content = 'Hi';
      const file = new File([content], 'small.txt', { type: 'text/plain' });
      const chunks = await chunkFile(file, 10);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toEqual(new Uint8Array([72, 105])); // "Hi"
    });
  });

  describe('File Assembly', () => {
    it('should assemble chunks back to file correctly', async () => {
      const originalContent = 'Hello World! This is a test file.';
      const originalFile = new File([originalContent], 'test.txt', { type: 'text/plain' });
      
      const chunks = await chunkFile(originalFile, 10);
      const assembledFile = assembleFile(chunks, 'test.txt', 'text/plain');

      expect(assembledFile.name).toBe('test.txt');
      expect(assembledFile.type).toBe('text/plain');
      expect(assembledFile.size).toBe(originalFile.size);

      const assembledContent = await assembledFile.text();
      expect(assembledContent).toBe(originalContent);
    });

    it('should handle empty chunks array', () => {
      const file = assembleFile([], 'empty.txt', 'text/plain');
      
      expect(file.name).toBe('empty.txt');
      expect(file.type).toBe('text/plain');
      expect(file.size).toBe(0);
    });

    it('should handle single chunk', () => {
      const chunk = new Uint8Array([72, 105]); // "Hi"
      const file = assembleFile([chunk], 'small.txt', 'text/plain');
      
      expect(file.name).toBe('small.txt');
      expect(file.size).toBe(2);
    });
  });

  describe('Message Creators', () => {
    it('should create valid HELLO message', () => {
      const message = createHelloMessage(
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        1024,
        'text/plain',
        16,
        64
      );

      expect(message.messageType).toBe(MessageType.HELLO);
      expect(message.sessionId).toBe('ABC12');
      expect(message.sequenceNumber).toBe(100);
      expect(message.partyType).toBe(PartyType.SENDER);
      expect(message.protocolVersion).toBe(ProtocolVersion.V0);
      expect(message.fileName).toBe('test.txt');
      expect(message.fileSize).toBe(1024);
      expect(message.mimeType).toBe('text/plain');
      expect(message.totalChunks).toBe(16);
      expect(message.chunkSize).toBe(64);
    });

    it('should create valid ACK message', () => {
      const message = createAckMessage('ABC12', 101);

      expect(message.messageType).toBe(MessageType.ACK);
      expect(message.sessionId).toBe('ABC12');
      expect(message.sequenceNumber).toBe(101);
    });

    it('should create valid PULL message', () => {
      const message = createPullMessage('ABC12', 102, 5);

      expect(message.messageType).toBe(MessageType.PULL);
      expect(message.sessionId).toBe('ABC12');
      expect(message.sequenceNumber).toBe(102);
      expect(message.chunkIndex).toBe(5);
    });

    it('should create valid DATA message', () => {
      const data = new Uint8Array([1, 2, 3]);
      const message = createDataMessage('ABC12', 103, 5, 6, data);

      expect(message.messageType).toBe(MessageType.DATA);
      expect(message.sessionId).toBe('ABC12');
      expect(message.sequenceNumber).toBe(103);
      expect(message.chunkIndex).toBe(5);
      expect(message.nextChunkIndex).toBe(6);
      expect(message.data).toBe(data);
    });

    it('should create valid ERROR message', () => {
      const message = createErrorMessage(ErrorType.INVALID_PARTY);

      expect(message.messageType).toBe(MessageType.ERROR);
      expect(message.errorType).toBe(ErrorType.INVALID_PARTY);
    });
  });
});