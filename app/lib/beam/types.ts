// Core types and enums for Beam protocol

export enum ProtocolVersion {
  V0 = 0,
}

export enum MessageType {
  HELLO = 0,
  ACK = 1,
  PULL = 2,
  DATA = 3,
  ERROR = 4,
}

export enum PartyType {
  SENDER = 0,
  RECEIVER = 1,
}

export enum ErrorType {
  INVALID_PARTY = 0,
}

export enum ErrorCode {
  PROTOCOL_ERROR = 'protocol_error',
  TIMEOUT = 'timeout',
  INVALID_PARTY = 'invalid_party',
  CONNECTION_LOST = 'connection_lost',
  FILE_TOO_LARGE = 'file_too_large',
  INVALID_CHUNK = 'invalid_chunk',
  SESSION_EXPIRED = 'session_expired',
}

// Transfer event types
export type TransferEvent =
  | "handshake"
  | "ack"
  | "chunk"
  | "pull"
  | "done"
  | "error";

// Event payload interfaces
export interface HandshakeEvent {
  sessionId: string;
  timestamp: number;
  fileName: string;
  fileSize: number;
  totalChunks: number;
}

export interface ChunkEvent {
  sessionId: string;
  timestamp: number;
  chunkIndex: number;
  totalChunks: number;
  data: Uint8Array;
}

export interface DoneEvent {
  sessionId: string;
  timestamp: number;
  file?: File; // Receiver only
}

// Progress tracking
export interface ProgressEvent {
  sessionId: string;
  fileName: string;
  fileSize: number;
  currentChunk: number;
  totalChunks: number;
  percentComplete: number;
  transferSpeed: number; // bytes per second
  estimatedTimeRemaining: number; // milliseconds
  updatedTime: number; // timestamp when this progress was calculated (milliseconds since epoch)
  startedTime: number; // timestamp when the transfer started
  bytesTransferred: number; // total bytes transferred so far
}

// Transfer options
export interface TransferOptions {
  chunkSize?: number; // Default: 64 bytes
  sessionIdLength?: number; // Default: 5 characters
  enableLogging?: boolean; // Default: false

  // Callback-based event handlers
  onHandshake?: (event: HandshakeEvent) => void;
  onChunk?: (event: ChunkEvent) => void;
  onDone?: (event: DoneEvent) => void;
  onError?: (error: TransferError) => void;
  onProgress?: (error: ProgressEvent) => void;
}

// Error class
export class TransferError extends Error {
  code: ErrorCode;
  sessionId?: string;
  details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    sessionId?: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'TransferError';
    this.code = code;
    this.sessionId = sessionId;
    this.details = details;
  }
}

// Writer/Reader interfaces
export interface Writer {
  write(data: string): Promise<void>;
}

export interface Reader {
  read(
    onData: (data: string) => void,
    onError: (error: string) => void
  ): Promise<void>;
}

// Base Message interface
export interface Message {
  messageType: MessageType;
  toTuple(): unknown[];
}

// Message implementations
export class HelloMessage implements Message {
  readonly messageType = MessageType.HELLO;

  constructor(
    public sessionId: string,
    public sequenceNumber: number,
    public partyType: PartyType,
    public protocolVersion: ProtocolVersion,
    public fileName: string,
    public fileSize: number,
    public mimeType: string,
    public totalChunks: number,
    public chunkSize: number
  ) { }

  toTuple(): [MessageType.HELLO, string, number, PartyType, ProtocolVersion, string, number, string, number, number] {
    return [
      this.messageType,
      this.sessionId,
      this.sequenceNumber,
      this.partyType,
      this.protocolVersion,
      this.fileName,
      this.fileSize,
      this.mimeType,
      this.totalChunks,
      this.chunkSize
    ];
  }
}

export class AckMessage implements Message {
  readonly messageType = MessageType.ACK;

  constructor(
    public sessionId: string,
    public sequenceNumber: number
  ) { }

  toTuple(): [MessageType.ACK, string, number] {
    return [
      this.messageType,
      this.sessionId,
      this.sequenceNumber
    ];
  }
}

export class PullMessage implements Message {
  readonly messageType = MessageType.PULL;

  constructor(
    public sessionId: string,
    public sequenceNumber: number,
    public chunkIndex: number
  ) { }

  toTuple(): [MessageType.PULL, string, number, number] {
    return [
      this.messageType,
      this.sessionId,
      this.sequenceNumber,
      this.chunkIndex
    ];
  }
}

export class DataMessage implements Message {
  readonly messageType = MessageType.DATA;

  constructor(
    public sessionId: string,
    public sequenceNumber: number,
    public chunkIndex: number,
    public nextChunkIndex: number,
    public data: Uint8Array
  ) { }

  toTuple(): [MessageType.DATA, string, number, number, number, Uint8Array] {
    return [
      this.messageType,
      this.sessionId,
      this.sequenceNumber,
      this.chunkIndex,
      this.nextChunkIndex,
      this.data
    ];
  }
}

export class ErrorMessage implements Message {
  readonly messageType = MessageType.ERROR;

  constructor(
    public errorType: ErrorType
  ) { }

  toTuple(): [MessageType.ERROR, ErrorType] {
    return [
      this.messageType,
      this.errorType
    ];
  }
}

// Message factory to create message objects from tuples
export function createMessageFromTuple(tuple: unknown[]): Message {
  if (!Array.isArray(tuple) || tuple.length === 0) {
    throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'Invalid message tuple');
  }

  const messageType = tuple[0] as MessageType;

  switch (messageType) {
    case MessageType.HELLO:
      if (tuple.length !== 10) {
        throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'HELLO message must have 10 fields');
      }
      return new HelloMessage(
        tuple[1] as string, tuple[2] as number, tuple[3] as PartyType, tuple[4] as ProtocolVersion,
        tuple[5] as string, tuple[6] as number, tuple[7] as string, tuple[8] as number, tuple[9] as number
      );

    case MessageType.ACK:
      if (tuple.length !== 3) {
        throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'ACK message must have 3 fields');
      }
      return new AckMessage(tuple[1] as string, tuple[2] as number);

    case MessageType.PULL:
      if (tuple.length !== 4) {
        throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'PULL message must have 4 fields');
      }
      return new PullMessage(tuple[1] as string, tuple[2] as number, tuple[3] as number);

    case MessageType.DATA:
      if (tuple.length !== 6) {
        throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'DATA message must have 6 fields');
      }
      return new DataMessage(tuple[1] as string, tuple[2] as number, tuple[3] as number, tuple[4] as number, tuple[5] as Uint8Array);

    case MessageType.ERROR:
      if (tuple.length !== 2) {
        throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'ERROR message must have 2 fields');
      }
      return new ErrorMessage(tuple[1] as ErrorType);

    default:
      throw new TransferError(ErrorCode.PROTOCOL_ERROR, `Unknown message type: ${messageType}`);
  }
}

// Legacy tuple types for backward compatibility
export type HelloMessageTuple = [MessageType.HELLO, string, number, PartyType, ProtocolVersion, string, number, string, number, number];
export type AckMessageTuple = [MessageType.ACK, string, number];
export type PullMessageTuple = [MessageType.PULL, string, number, number];
export type DataMessageTuple = [MessageType.DATA, string, number, number, number, Uint8Array];
export type ErrorMessageTuple = [MessageType.ERROR, ErrorType];

export type ProtocolMessage = Message;
export type ProtocolMessageTuple =
  | HelloMessageTuple
  | AckMessageTuple
  | PullMessageTuple
  | DataMessageTuple
  | ErrorMessageTuple;

// Transfer states
export enum TransferState {
  IDLE = 'idle',
  HANDSHAKE = 'handshake',
  TRANSFER = 'transfer',
  DONE = 'done',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}