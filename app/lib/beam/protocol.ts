import { encode, decode } from '@msgpack/msgpack';
import { 
  ProtocolMessage, 
  MessageType, 
  HelloMessage,
  AckMessage,
  PullMessage,
  DataMessage,
  ErrorMessage,
  createMessageFromTuple,
  TransferError,
  ErrorCode,
  PartyType,
  ProtocolVersion,
  ErrorType
} from './types';

/**
 * Serializes a protocol message to Base64 string for QR code encoding
 */
export function serializeMessage(message: ProtocolMessage): string {
  if (!message || typeof message.toTuple !== 'function') {
    throw new TransferError(
      ErrorCode.PROTOCOL_ERROR,
      'Message must be a valid protocol message object'
    );
  }

  try {
    const tuple = message.toTuple();
    const packed = encode(tuple);
    return btoa(String.fromCharCode(...new Uint8Array(packed)));
  } catch (error) {
    throw new TransferError(
      ErrorCode.PROTOCOL_ERROR,
      `Failed to serialize message: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Deserializes a Base64 string back to a protocol message
 */
export function deserializeMessage(data: string): ProtocolMessage {
  try {
    const binaryString = atob(data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const tuple = decode(bytes) as unknown[];
    return createMessageFromTuple(tuple);
  } catch (error) {
    throw new TransferError(
      ErrorCode.PROTOCOL_ERROR,
      `Failed to deserialize message: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validates that a message has the expected type and structure
 */
export function validateMessage(message: unknown, expectedType: MessageType): ProtocolMessage {
  if (!message || typeof message !== 'object' || !('toTuple' in message) || typeof message.toTuple !== 'function') {
    throw new TransferError(
      ErrorCode.PROTOCOL_ERROR,
      'Message must be a valid protocol message object'
    );
  }

  if (!('messageType' in message) || message.messageType !== expectedType) {
    throw new TransferError(
      ErrorCode.PROTOCOL_ERROR,
      `Expected message type ${expectedType}, got ${('messageType' in message) ? message.messageType : 'unknown'}`
    );
  }

  // Type-specific validation for message structure
  try {
    const tuple = message.toTuple();
    switch (expectedType) {
      case MessageType.HELLO:
        if (tuple.length !== 10) {
          throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'HELLO message must have 10 fields');
        }
        break;
      case MessageType.ACK:
        if (tuple.length !== 3) {
          throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'ACK message must have 3 fields');
        }
        break;
      case MessageType.PULL:
        if (tuple.length !== 4) {
          throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'PULL message must have 4 fields');
        }
        break;
      case MessageType.DATA:
        if (tuple.length !== 6) {
          throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'DATA message must have 6 fields');
        }
        break;
      case MessageType.ERROR:
        if (tuple.length !== 2) {
          throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'ERROR message must have 2 fields');
        }
        break;
    }
  } catch (error) {
    throw new TransferError(
      ErrorCode.PROTOCOL_ERROR,
      `Message validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return message as ProtocolMessage;
}

/**
 * Creates a HELLO message
 */
export function createHelloMessage(
  sessionId: string,
  sequenceNumber: number,
  partyType: PartyType,
  protocolVersion: ProtocolVersion,
  fileName: string,
  fileSize: number,
  mimeType: string,
  totalChunks: number,
  chunkSize: number
): HelloMessage {
  return new HelloMessage(
    sessionId,
    sequenceNumber,
    partyType,
    protocolVersion,
    fileName,
    fileSize,
    mimeType,
    totalChunks,
    chunkSize
  );
}

/**
 * Creates an ACK message
 */
export function createAckMessage(
  sessionId: string,
  sequenceNumber: number
): AckMessage {
  return new AckMessage(
    sessionId,
    sequenceNumber
  );
}

/**
 * Creates a PULL message
 */
export function createPullMessage(
  sessionId: string,
  sequenceNumber: number,
  chunkIndex: number
): PullMessage {
  return new PullMessage(
    sessionId,
    sequenceNumber,
    chunkIndex
  );
}

/**
 * Creates a DATA message
 */
export function createDataMessage(
  sessionId: string,
  sequenceNumber: number,
  chunkIndex: number,
  nextChunkIndex: number,
  data: Uint8Array
): DataMessage {
  return new DataMessage(
    sessionId,
    sequenceNumber,
    chunkIndex,
    nextChunkIndex,
    data
  );
}

/**
 * Creates an ERROR message
 */
export function createErrorMessage(errorType: ErrorType): ErrorMessage {
  return new ErrorMessage(
    errorType
  );
}

/**
 * Generates a session ID from a file name using a simple hash
 */
export function generateSessionId(fileName: string, length: number = 5): string {
  let hash = 0;
  for (let i = 0; i < fileName.length; i++) {
    const char = fileName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to alphanumeric string
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  let absHash = Math.abs(hash);
  
  for (let i = 0; i < length; i++) {
    result += chars[absHash % chars.length];
    absHash = Math.floor(absHash / chars.length);
  }
  
  return result.padEnd(length, 'A');
}

/**
 * Chunks a file into smaller pieces
 */
export async function chunkFile(file: File, chunkSize: number): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  const fileSize = file.size;
  
  for (let offset = 0; offset < fileSize; offset += chunkSize) {
    const slice = file.slice(offset, offset + chunkSize);
    const arrayBuffer = await slice.arrayBuffer();
    chunks.push(new Uint8Array(arrayBuffer));
  }
  
  return chunks;
}

/**
 * Assembles chunks back into a File
 */
export function assembleFile(chunks: Uint8Array[], fileName: string, mimeType: string): File {
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const assembled = new Uint8Array(totalSize);
  
  let offset = 0;
  for (const chunk of chunks) {
    assembled.set(chunk, offset);
    offset += chunk.length;
  }
  
  return new File([assembled], fileName, { type: mimeType });
}