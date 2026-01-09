// Main exports for Beam library
export { FileSender } from './sender';
export { FileReceiver } from './receiver';

export type {
  Writer,
  Reader,
  TransferOptions,
  ProgressEvent as TransferProgress,
  TransferEvent,
  HandshakeEvent,
  ChunkEvent,
  DoneEvent,
  ProtocolMessage,
  HelloMessage,
  AckMessage,
  PullMessage,
  DataMessage,
  ErrorMessage,
} from './types';

export {
  TransferError,
  ErrorCode,
  MessageType,
  PartyType,
  ProtocolVersion,
  ErrorType,
  TransferState,
} from './types';

export {
  serializeMessage,
  deserializeMessage,
  generateSessionId,
  chunkFile,
  assembleFile,
} from './protocol';

// Session storage exports
export type { SessionStorage } from './session-storage';
export {
  IndexedSessionStorage,
  getLastSenderSession,
  getLastReceiverSession,
  saveSenderSession,
  saveReceiverSession,
  clearSenderSessions,
  clearReceiverSessions,
  clearAllSessions,
} from './session-storage';

// File storage exports for resumable transfers
export type { FileStorage, StoredFileData, FileStorageStats } from './file-storage';
export { IndexedFileStorage, defaultFileStorage } from './file-storage';