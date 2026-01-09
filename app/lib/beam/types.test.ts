import {
  MessageType,
  PartyType,
  ProtocolVersion,
  ErrorType,
  HelloMessage,
  AckMessage,
  PullMessage,
  DataMessage,
  ErrorMessage,
  createMessageFromTuple,
  TransferError
} from './types';

describe('Message Types', () => {
  describe('HelloMessage', () => {
    it('should create HelloMessage with correct properties', () => {
      const message = new HelloMessage(
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

    it('should convert to tuple correctly', () => {
      const message = new HelloMessage(
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

      const tuple = message.toTuple();
      expect(tuple).toEqual([
        MessageType.HELLO,
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        1024,
        'text/plain',
        16,
        64
      ]);
    });
  });

  describe('AckMessage', () => {
    it('should create AckMessage with correct properties', () => {
      const message = new AckMessage('ABC12', 101);

      expect(message.messageType).toBe(MessageType.ACK);
      expect(message.sessionId).toBe('ABC12');
      expect(message.sequenceNumber).toBe(101);
    });

    it('should convert to tuple correctly', () => {
      const message = new AckMessage('ABC12', 101);
      const tuple = message.toTuple();
      
      expect(tuple).toEqual([
        MessageType.ACK,
        'ABC12',
        101
      ]);
    });
  });

  describe('PullMessage', () => {
    it('should create PullMessage with correct properties', () => {
      const message = new PullMessage('ABC12', 102, 5);

      expect(message.messageType).toBe(MessageType.PULL);
      expect(message.sessionId).toBe('ABC12');
      expect(message.sequenceNumber).toBe(102);
      expect(message.chunkIndex).toBe(5);
    });

    it('should convert to tuple correctly', () => {
      const message = new PullMessage('ABC12', 102, 5);
      const tuple = message.toTuple();
      
      expect(tuple).toEqual([
        MessageType.PULL,
        'ABC12',
        102,
        5
      ]);
    });
  });

  describe('DataMessage', () => {
    it('should create DataMessage with correct properties', () => {
      const data = new Uint8Array([1, 2, 3]);
      const message = new DataMessage('ABC12', 103, 5, 6, data);

      expect(message.messageType).toBe(MessageType.DATA);
      expect(message.sessionId).toBe('ABC12');
      expect(message.sequenceNumber).toBe(103);
      expect(message.chunkIndex).toBe(5);
      expect(message.nextChunkIndex).toBe(6);
      expect(message.data).toBe(data);
    });

    it('should convert to tuple correctly', () => {
      const data = new Uint8Array([1, 2, 3]);
      const message = new DataMessage('ABC12', 103, 5, 6, data);
      const tuple = message.toTuple();
      
      expect(tuple).toEqual([
        MessageType.DATA,
        'ABC12',
        103,
        5,
        6,
        data
      ]);
    });
  });

  describe('ErrorMessage', () => {
    it('should create ErrorMessage with correct properties', () => {
      const message = new ErrorMessage(ErrorType.INVALID_PARTY);

      expect(message.messageType).toBe(MessageType.ERROR);
      expect(message.errorType).toBe(ErrorType.INVALID_PARTY);
    });

    it('should convert to tuple correctly', () => {
      const message = new ErrorMessage(ErrorType.INVALID_PARTY);
      const tuple = message.toTuple();
      
      expect(tuple).toEqual([
        MessageType.ERROR,
        ErrorType.INVALID_PARTY
      ]);
    });
  });

  describe('createMessageFromTuple', () => {
    it('should create HelloMessage from tuple', () => {
      const tuple = [
        MessageType.HELLO,
        'ABC12',
        100,
        PartyType.SENDER,
        ProtocolVersion.V0,
        'test.txt',
        1024,
        'text/plain',
        16,
        64
      ];

      const message = createMessageFromTuple(tuple);
      expect(message).toBeInstanceOf(HelloMessage);
      expect(message.messageType).toBe(MessageType.HELLO);
      expect((message as HelloMessage).sessionId).toBe('ABC12');
      expect((message as HelloMessage).fileName).toBe('test.txt');
    });

    it('should create AckMessage from tuple', () => {
      const tuple = [MessageType.ACK, 'ABC12', 101];

      const message = createMessageFromTuple(tuple);
      expect(message).toBeInstanceOf(AckMessage);
      expect(message.messageType).toBe(MessageType.ACK);
      expect((message as AckMessage).sessionId).toBe('ABC12');
      expect((message as AckMessage).sequenceNumber).toBe(101);
    });

    it('should create PullMessage from tuple', () => {
      const tuple = [MessageType.PULL, 'ABC12', 102, 5];

      const message = createMessageFromTuple(tuple);
      expect(message).toBeInstanceOf(PullMessage);
      expect(message.messageType).toBe(MessageType.PULL);
      expect((message as PullMessage).chunkIndex).toBe(5);
    });

    it('should create DataMessage from tuple', () => {
      const data = new Uint8Array([1, 2, 3]);
      const tuple = [MessageType.DATA, 'ABC12', 103, 5, 6, data];

      const message = createMessageFromTuple(tuple);
      expect(message).toBeInstanceOf(DataMessage);
      expect(message.messageType).toBe(MessageType.DATA);
      expect((message as DataMessage).data).toBe(data);
    });

    it('should create ErrorMessage from tuple', () => {
      const tuple = [MessageType.ERROR, ErrorType.INVALID_PARTY];

      const message = createMessageFromTuple(tuple);
      expect(message).toBeInstanceOf(ErrorMessage);
      expect(message.messageType).toBe(MessageType.ERROR);
      expect((message as ErrorMessage).errorType).toBe(ErrorType.INVALID_PARTY);
    });

    it('should throw error for invalid tuple', () => {
      expect(() => createMessageFromTuple([])).toThrow(TransferError);
      expect(() => createMessageFromTuple(['invalid'])).toThrow(TransferError);
    });

    it('should throw error for unknown message type', () => {
      const tuple = [999, 'ABC12', 100]; // Invalid message type
      expect(() => createMessageFromTuple(tuple)).toThrow(TransferError);
    });

    it('should throw error for wrong field count', () => {
      // HELLO with wrong field count
      const invalidHello = [MessageType.HELLO, 'ABC12']; // Missing fields
      expect(() => createMessageFromTuple(invalidHello)).toThrow(TransferError);

      // ACK with wrong field count
      const invalidAck = [MessageType.ACK]; // Missing fields
      expect(() => createMessageFromTuple(invalidAck)).toThrow(TransferError);

      // PULL with wrong field count
      const invalidPull = [MessageType.PULL, 'ABC12']; // Missing fields
      expect(() => createMessageFromTuple(invalidPull)).toThrow(TransferError);

      // DATA with wrong field count
      const invalidData = [MessageType.DATA, 'ABC12', 103]; // Missing fields
      expect(() => createMessageFromTuple(invalidData)).toThrow(TransferError);

      // ERROR with wrong field count
      const invalidError = [MessageType.ERROR]; // Missing fields
      expect(() => createMessageFromTuple(invalidError)).toThrow(TransferError);
    });
  });

  describe('Round-trip conversion', () => {
    it('should maintain data integrity through tuple conversion', () => {
      const originalHello = new HelloMessage(
        'TEST123',
        999,
        PartyType.RECEIVER,
        ProtocolVersion.V0,
        'document.pdf',
        2048,
        'application/pdf',
        32,
        128
      );

      const tuple = originalHello.toTuple();
      const recreatedMessage = createMessageFromTuple(tuple) as HelloMessage;

      expect(recreatedMessage.sessionId).toBe(originalHello.sessionId);
      expect(recreatedMessage.sequenceNumber).toBe(originalHello.sequenceNumber);
      expect(recreatedMessage.partyType).toBe(originalHello.partyType);
      expect(recreatedMessage.protocolVersion).toBe(originalHello.protocolVersion);
      expect(recreatedMessage.fileName).toBe(originalHello.fileName);
      expect(recreatedMessage.fileSize).toBe(originalHello.fileSize);
      expect(recreatedMessage.mimeType).toBe(originalHello.mimeType);
      expect(recreatedMessage.totalChunks).toBe(originalHello.totalChunks);
      expect(recreatedMessage.chunkSize).toBe(originalHello.chunkSize);
    });

    it('should handle binary data correctly', () => {
      const originalData = new Uint8Array([0, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
      const originalMessage = new DataMessage('BIN001', 42, 10, 11, originalData);

      const tuple = originalMessage.toTuple();
      const recreatedMessage = createMessageFromTuple(tuple) as DataMessage;

      expect(recreatedMessage.data).toEqual(originalData);
      expect(recreatedMessage.sessionId).toBe('BIN001');
      expect(recreatedMessage.chunkIndex).toBe(10);
      expect(recreatedMessage.nextChunkIndex).toBe(11);
    });
  });
});