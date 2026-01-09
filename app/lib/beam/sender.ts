import {
  Writer,
  Reader,
  TransferOptions,
  ProgressEvent,
  TransferState,
  TransferError,
  ErrorCode,
  MessageType,
  PartyType,
  ProtocolVersion,
  ErrorType,
  ProtocolMessage
} from './types';

import {
  serializeMessage,
  deserializeMessage,
  validateMessage,
  createHelloMessage,
  createAckMessage,
  createDataMessage,
  generateSessionId,
  chunkFile
} from './protocol';

import { FileStorage, defaultFileStorage } from './file-storage';
import { saveSenderSession } from './session-storage';

/**
 * Data required to resume a file transfer session
 */
export interface ResumableSessionData {
  sessionId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  chunks: Uint8Array[];
  sentChunks: number;
}

export class FileSender {
  private writer: Writer;
  private reader: Reader;
  private options: TransferOptions;
  private state: TransferState = TransferState.IDLE;
  private sessionId: string = '';
  private sequenceNumber: number = 0;
  private chunks: Uint8Array[] = [];
  private file: File | null = null;
  private fileName: string = '';
  private fileSize: number = 0;
  private mimeType: string = '';
  private prevTime: number = 0;
  private sentChunks: number = 0;
  private isListening: boolean = false;
  private currentResolve: ((value: void) => void) | null = null;
  private currentReject: ((reason: Error) => void) | null = null;
  private fileStorage: FileStorage;
  private isResumedSession: boolean = false;

  constructor(writer: Writer, reader: Reader, options: TransferOptions = {}, fileStorage?: FileStorage) {
    this.writer = writer;
    this.reader = reader;
    this.options = {
      ...options,
      chunkSize: options.chunkSize ?? 64,
      sessionIdLength: options.sessionIdLength ?? 5,
      enableLogging: options.enableLogging ?? false,
    };
    this.fileStorage = fileStorage || defaultFileStorage;

    // Initialize sequence number with random value to prevent collisions
    this.sequenceNumber = Math.floor(Math.random() * 1000);
  }

  async send(file: File): Promise<void> {
    if (this.state !== TransferState.IDLE) {
      throw new TransferError(
        ErrorCode.PROTOCOL_ERROR,
        'Transfer already in progress'
      );
    }

    this.file = file;
    this.fileName = file.name;
    this.fileSize = file.size;
    this.mimeType = file.type || 'application/octet-stream';
    this.sessionId = generateSessionId(file.name, this.options.sessionIdLength ?? 5);
    this.chunks = await chunkFile(file, this.options.chunkSize ?? 64);
    this.sentChunks = 0;
    this.prevTime = Date.now();
    this.isResumedSession = false;

    // Store chunks for potential resume
    try {
      await this.fileStorage.storeFileChunks(this.fileName, this.fileSize, this.mimeType, this.chunks);
      this.log(`Stored ${this.chunks.length} chunks for potential resume`);
    } catch (error) {
      this.log(`Warning: Failed to store chunks for resume: ${error}`);
      // Continue without storing - this is not a critical failure
    }

    this.log(`Starting file transfer for ${file.name} (${file.size} bytes, ${this.chunks.length} chunks)`);

    // Save initial sender session for potential resumption
    try {
      const initialProgress: ProgressEvent = {
        sessionId: this.sessionId,
        fileName: this.fileName,
        fileSize: this.fileSize,
        currentChunk: 0,
        totalChunks: this.chunks.length,
        percentComplete: 0,
        transferSpeed: 0,
        estimatedTimeRemaining: 0,
        updatedTime: this.prevTime,
        startedTime: this.prevTime,
        bytesTransferred: 0
      };
      
      await saveSenderSession(initialProgress);
      this.log(`Saved initial sender session for ${file.name} (Session: ${this.sessionId})`);
    } catch (error) {
      this.log(`Warning: Failed to save initial sender session: ${error}`);
      // Continue without saving - this is not a critical failure
    }

    return new Promise<void>((resolve, reject) => {
      this.currentResolve = resolve;
      this.currentReject = reject;

      this.startHandshake().catch(reject);
    });
  }

  /**
   * Resume a file transfer session using stored file chunks
   */
  async sendResumable(
    sessionData: ResumableSessionData,
  ): Promise<void> {
    if (this.state !== TransferState.IDLE) {
      throw new TransferError(
        ErrorCode.PROTOCOL_ERROR,
        'Transfer already in progress'
      );
    }

    // Validate chunk integrity
    if (!this.validateChunks(sessionData.chunks, sessionData.fileSize, sessionData.chunkSize)) {
      throw new TransferError(
        ErrorCode.PROTOCOL_ERROR,
        'Stored chunks failed integrity validation'
      );
    }

    // Set up session from stored data
    this.sessionId = sessionData.sessionId;
    this.fileName = sessionData.fileName;
    this.fileSize = sessionData.fileSize;
    this.mimeType = sessionData.mimeType;
    this.chunks = sessionData.chunks;
    this.sentChunks = sessionData.sentChunks;
    this.prevTime = Date.now();
    this.isResumedSession = true;
    this.file = null; // No original file object available

    this.log(`Resuming file transfer for ${this.fileName} (${this.fileSize} bytes, ${this.chunks.length} chunks, starting from chunk ${this.sentChunks})`);

    return new Promise<void>((resolve, reject) => {
      this.currentResolve = resolve;
      this.currentReject = reject;

      this.startHandshake().catch(reject);
    });
  }

  /**
   * Create resumable session from stored file
   */
  static async createResumableSession(
    fileName: string,
    sessionId: string,
    sentChunks: number,
    fileStorage?: FileStorage
  ): Promise<ResumableSessionData | null> {
    const storage = fileStorage || defaultFileStorage;

    try {
      const storedData = await storage.getFileChunks(fileName);
      if (!storedData) {
        return null;
      }

      return {
        sessionId,
        fileName: storedData.fileName,
        fileSize: storedData.fileSize,
        mimeType: storedData.mimeType,
        totalChunks: storedData.totalChunks,
        chunkSize: storedData.chunkSize,
        chunks: storedData.chunks,
        sentChunks
      };
    } catch (error) {
      console.error('Failed to create resumable session:', error);
      return null;
    }
  }

  async cancel(): Promise<void> {
    this.log('Cancelling transfer');
    this.state = TransferState.CANCELLED;
    this.stopListening();

    if (this.currentReject) {
      // this.currentReject(new TransferError(ErrorCode.CONNECTION_LOST, 'Transfer cancelled'));
      this.currentReject = null;
      this.currentResolve = null;
    }
  }

  /**
   * Validate integrity of stored chunks
   */
  private validateChunks(chunks: Uint8Array[], expectedFileSize: number, expectedChunkSize: number): boolean {
    if (!chunks || chunks.length === 0) {
      return false;
    }

    // Calculate total size from chunks
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    // Allow for small variations due to last chunk potentially being smaller
    if (Math.abs(totalSize - expectedFileSize) > expectedChunkSize) {
      this.log(`Chunk validation failed: total size mismatch (${totalSize} vs ${expectedFileSize})`);
      return false;
    }

    // Validate chunk sizes (all but last should be expectedChunkSize)
    for (let i = 0; i < chunks.length - 1; i++) {
      if (chunks[i].length !== expectedChunkSize) {
        this.log(`Chunk validation failed: chunk ${i} size mismatch (${chunks[i].length} vs ${expectedChunkSize})`);
        return false;
      }
    }

    // Last chunk can be smaller or equal to expectedChunkSize
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk.length > expectedChunkSize) {
      this.log(`Chunk validation failed: last chunk too large (${lastChunk.length} vs ${expectedChunkSize})`);
      return false;
    }

    return true;
  }

  private async startHandshake(): Promise<void> {
    this.state = TransferState.HANDSHAKE;
    this.startListening();

    // For resumed sessions, we have fileName, fileSize, and mimeType from stored data
    // For regular sessions, we get them from the file object
    if (!this.isResumedSession && !this.file) {
      throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'No file to send');
    }

    const fileName = this.isResumedSession ? this.fileName : this.file!.name;
    const fileSize = this.isResumedSession ? this.fileSize : this.file!.size;
    const mimeType = this.isResumedSession ? this.mimeType : (this.file!.type || 'application/octet-stream');

    const helloMessage = createHelloMessage(
      this.sessionId,
      this.sequenceNumber++,
      PartyType.SENDER,
      ProtocolVersion.V0,
      fileName,
      fileSize,
      mimeType,
      this.chunks.length,
      this.options.chunkSize ?? 64
    );

    this.log('Sending HELLO message');
    await this.sendMessage(helloMessage);
  }

  private async startListening(): Promise<void> {
    if (this.isListening) return;

    this.isListening = true;
    this.reader.read(
      (data: string) => this.handleMessage(data),
      (error: string) => this.handleError(error)
    ).catch(error => this.handleError(error.message));
  }

  private stopListening(): void {
    this.isListening = false;
  }

  private async handleMessage(data: string): Promise<void> {
    try {
      const message = deserializeMessage(data);
      const messageTypeName = MessageType[message.messageType] || `UNKNOWN(${message.messageType})`;
      this.log(`Received message type: ${messageTypeName}`);

      switch (message.messageType) {
        case MessageType.ACK:
          await this.handleAckMessage(message);
          break;
        case MessageType.PULL:
          await this.handlePullMessage(message);
          break;
        case MessageType.ERROR:
          await this.handleErrorMessage(message);
          break;
        default:
          throw new TransferError(
            ErrorCode.PROTOCOL_ERROR,
            `Unexpected message type: ${message.messageType}`
          );
      }
    } catch (error) {
      this.handleError(error instanceof Error ? error.message : String(error));
    }
  }

  private async handleAckMessage(message: ProtocolMessage): Promise<void> {
    const ackMessage = validateMessage(message, MessageType.ACK) as import('./types').AckMessage;
    const { sessionId } = ackMessage;

    if (sessionId !== this.sessionId) {
      throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'Session ID mismatch');
    }

    if (this.state === TransferState.HANDSHAKE) {
      this.log('Handshake completed, entering transfer state');
      this.state = TransferState.TRANSFER;

      // Send ACK back to complete handshake
      const responseAck = createAckMessage(this.sessionId, this.sequenceNumber++);
      await this.sendMessage(responseAck);

      // Emit handshake event
      if (this.options.onHandshake) {
        const fileName = this.isResumedSession ? this.fileName : this.file!.name;
        const fileSize = this.isResumedSession ? this.fileSize : this.file!.size;

        this.options.onHandshake({
          sessionId: this.sessionId,
          timestamp: Date.now(),
          fileName,
          fileSize,
          totalChunks: this.chunks.length
        });
      }

      // Handle empty files (0 chunks) - complete immediately
      if (this.chunks.length === 0) {
        this.completeTransfer();
      }
    }
  }

  private async handlePullMessage(message: ProtocolMessage): Promise<void> {
    if (this.state !== TransferState.TRANSFER) {
      throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'Not in transfer state');
    }

    const pullMessage = validateMessage(message, MessageType.PULL) as import('./types').PullMessage;
    const { sessionId, chunkIndex } = pullMessage;

    if (sessionId !== this.sessionId) {
      throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'Session ID mismatch');
    }

    this.log(`Received PULL request for chunk ${chunkIndex}`);

    let nextChunkIndex = -1;
    let chunkData: Uint8Array = new Uint8Array(0);

    if (chunkIndex >= 0 && chunkIndex < this.chunks.length) {
      chunkData = new Uint8Array(this.chunks[chunkIndex]);
      nextChunkIndex = chunkIndex + 1 < this.chunks.length ? chunkIndex + 1 : -1;
      this.sentChunks = chunkIndex;

      this.log(`Sending chunk ${chunkIndex}/${this.chunks.length}`);

      // Emit chunk event
      if (this.options.onChunk) {
        this.options.onChunk({
          sessionId: this.sessionId,
          timestamp: Date.now(),
          chunkIndex,
          totalChunks: this.chunks.length,
          data: chunkData
        });
      }

      // Update progress
      this.updateProgress();
    }

    const dataMessage = createDataMessage(
      this.sessionId,
      this.sequenceNumber++,
      chunkIndex,
      nextChunkIndex,
      chunkData
    );

    await this.sendMessage(dataMessage);

    // Check if transfer is complete
    if (nextChunkIndex === -1) {
      this.completeTransfer();
    }
  }

  private async handleErrorMessage(message: ProtocolMessage): Promise<void> {
    const errorMessage = validateMessage(message, MessageType.ERROR) as import('./types').ErrorMessage;
    const { errorType } = errorMessage;

    let errorText = 'Unknown error';
    switch (errorType) {
      case ErrorType.INVALID_PARTY:
        errorText = 'Invalid party type detected';
        break;
    }

    const error = new TransferError(ErrorCode.INVALID_PARTY, errorText, this.sessionId);
    this.handleError(error.message);
  }

  private updateProgress(): void {
    if (!this.options.onProgress) return;

    // For resumed sessions, we need fileName and fileSize from stored data
    // For regular sessions, we get them from the file object
    if (!this.isResumedSession && !this.file) return;

    const now = Date.now();
    const elapsed = (now - this.prevTime) / 1000; // seconds
    this.prevTime = now;

    const chunkSize = this.options.chunkSize ?? 64;
    const bytesTransferred = chunkSize;

    const percentComplete = (this.sentChunks / this.chunks.length) * 100;
    const transferSpeed = elapsed > 0 ? bytesTransferred / elapsed : 0;
    const remainingChunks = this.chunks.length - this.sentChunks;
    const estimatedTimeRemaining = transferSpeed > 0 ? (remainingChunks * elapsed) : 0;

    const fileName = this.isResumedSession ? this.fileName : this.file!.name;
    const fileSize = this.isResumedSession ? this.fileSize : this.file!.size;

    const progress: ProgressEvent = {
      sessionId: this.sessionId,
      fileName,
      fileSize,
      currentChunk: this.sentChunks,
      totalChunks: this.chunks.length,
      percentComplete,
      transferSpeed,
      estimatedTimeRemaining,
      updatedTime: now,
      startedTime: this.prevTime,
      bytesTransferred
    };
    this.options.onProgress(progress);
  }

  private completeTransfer(): void {
    this.log('Transfer completed successfully');
    this.state = TransferState.DONE;
    this.stopListening();

    // Clean up stored chunks after successful transfer
    this.cleanupStoredChunks();

    // Emit done event
    if (this.options.onDone) {
      this.options.onDone({
        sessionId: this.sessionId,
        timestamp: Date.now()
      });
    }

    if (this.currentResolve) {
      this.currentResolve();
      this.currentResolve = null;
      this.currentReject = null;
    }
  }

  /**
   * Clean up stored chunks after transfer completion
   */
  private async cleanupStoredChunks(): Promise<void> {
    try {
      const fileName = this.isResumedSession ? this.fileName : this.file?.name;
      if (fileName) {
        await this.fileStorage.deleteFileChunks(fileName);
        this.log(`Cleaned up stored chunks for ${fileName}`);
      }
    } catch (error) {
      this.log(`Warning: Failed to cleanup stored chunks: ${error}`);
      // Not a critical error, continue
    }
  }

  private handleError(error: string): void {
    this.log(`Error: ${error}`);
    // this.state = TransferState.ERROR;
    // this.stopListening();

    // const transferError = new TransferError(ErrorCode.PROTOCOL_ERROR, error, this.sessionId);

    // if (this.options.onError) {
    //   this.options.onError(transferError);
    // }

    // if (this.currentReject) {
    //   this.currentReject(transferError);
    //   this.currentReject = null;
    //   this.currentResolve = null;
    // }
  }

  private async sendMessage(message: ProtocolMessage): Promise<void> {
    const serialized = serializeMessage(message);
    await this.writer.write(serialized);
  }

  private log(message: string): void {
    if (this.options.enableLogging ?? false) {
      console.log(`[FileSender:${this.sessionId}] ${message}`);
    }
  }
}