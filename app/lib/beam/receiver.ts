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
  createAckMessage,
  createPullMessage,
  createErrorMessage,
  assembleFile
} from './protocol';

export class FileReceiver {
  private writer: Writer;
  private reader: Reader;
  private options: TransferOptions;
  private state: TransferState = TransferState.IDLE;
  private sessionId: string = '';
  private sequenceNumber: number = 0;
  private chunks: Map<number, Uint8Array> = new Map();
  private fileName: string = '';
  private fileSize: number = 0;
  private mimeType: string = '';
  private totalChunks: number = 0;
  private chunkSize: number = 0;
  private currentChunkIndex: number = 0;
  private prevTime: number = 0;
  private isListening: boolean = false;
  private currentResolve: ((value: File) => void) | null = null;
  private currentReject: ((reason: Error) => void) | null = null;

  constructor(writer: Writer, reader: Reader, options: TransferOptions = {}) {
    this.writer = writer;
    this.reader = reader;
    this.options = {
      ...options,
      chunkSize: options.chunkSize ?? 64,
      sessionIdLength: options.sessionIdLength ?? 5,
      enableLogging: options.enableLogging ?? false,
    };

    // Initialize sequence number with random value to prevent collisions
    this.sequenceNumber = Math.floor(Math.random() * 1000);
  }

  async receive(): Promise<File> {
    if (this.state !== TransferState.IDLE) {
      throw new TransferError(
        ErrorCode.PROTOCOL_ERROR,
        'Reception already in progress'
      );
    }

    this.chunks.clear();
    this.currentChunkIndex = 0;
    this.prevTime = Date.now();

    this.log('Starting file reception');

    return new Promise<File>((resolve, reject) => {
      this.currentResolve = resolve;
      this.currentReject = reject;

      this.startScanning().catch(reject);
    });
  }

  async cancel(): Promise<void> {
    this.log('Cancelling reception');
    this.state = TransferState.CANCELLED;
    this.stopListening();

    if (this.currentReject) {
      // this.currentReject(new TransferError(ErrorCode.CONNECTION_LOST, 'Reception cancelled'));
      this.currentReject = null;
      this.currentResolve = null;
    }
  }

  private async startScanning(): Promise<void> {
    this.state = TransferState.HANDSHAKE;
    this.startListening();
    this.log('Scanning for HELLO message');
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
        case MessageType.HELLO:
          await this.handleHelloMessage(message);
          break;
        case MessageType.ACK:
          await this.handleAckMessage(message);
          break;
        case MessageType.DATA:
          await this.handleDataMessage(message);
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

  private async handleHelloMessage(message: ProtocolMessage): Promise<void> {
    if (this.state !== TransferState.HANDSHAKE) {
      return; // Ignore if not in handshake state
    }

    const helloMessage = validateMessage(message, MessageType.HELLO) as import('./types').HelloMessage;
    const { sessionId, partyType, protocolVersion, fileName, fileSize, mimeType, totalChunks, chunkSize } = helloMessage;

    // Check for collision - if another receiver tries to connect
    if (partyType === PartyType.RECEIVER) {
      this.log('Collision detected: another receiver trying to connect');
      const errorMessage = createErrorMessage(ErrorType.INVALID_PARTY);
      await this.sendMessage(errorMessage);
      throw new TransferError(ErrorCode.INVALID_PARTY, 'Another receiver detected');
    }

    if (partyType !== PartyType.SENDER) {
      throw new TransferError(ErrorCode.INVALID_PARTY, 'Expected sender party type');
    }

    if (protocolVersion !== ProtocolVersion.V0) {
      throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'Unsupported protocol version');
    }

    this.sessionId = sessionId;
    this.fileName = fileName;
    this.fileSize = fileSize;
    this.mimeType = mimeType;
    this.totalChunks = totalChunks;
    this.chunkSize = chunkSize;

    this.log(`Handshake received: ${fileName} (${fileSize} bytes, ${totalChunks} chunks)`);

    // Send ACK to confirm handshake
    const ackMessage = createAckMessage(this.sessionId, this.sequenceNumber++);
    await this.sendMessage(ackMessage);

    // Emit handshake event
    if (this.options.onHandshake) {
      this.options.onHandshake({
        sessionId: this.sessionId,
        timestamp: Date.now(),
        fileName: this.fileName,
        fileSize: this.fileSize,
        totalChunks: this.totalChunks
      });
    }
  }

  private async handleAckMessage(message: ProtocolMessage): Promise<void> {
    const ackMessage = validateMessage(message, MessageType.ACK) as import('./types').AckMessage;
    const { sessionId } = ackMessage;

    if (sessionId !== this.sessionId) {
      throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'Session ID mismatch');
    }

    if (this.state === TransferState.HANDSHAKE) {
      this.log('Handshake completed, starting transfer');
      this.state = TransferState.TRANSFER;
      this.currentChunkIndex = 0;

      // Handle empty files (0 chunks)
      if (this.totalChunks === 0) {
        await this.completeTransfer();
      } else {
        // Start pulling the first chunk
        await this.requestNextChunk();
      }
    }
  }

  private async handleDataMessage(message: ProtocolMessage): Promise<void> {
    if (this.state !== TransferState.TRANSFER) {
      throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'Not in transfer state');
    }

    const dataMessage = validateMessage(message, MessageType.DATA) as import('./types').DataMessage;
    const { sessionId, chunkIndex, nextChunkIndex, data } = dataMessage;

    if (sessionId !== this.sessionId) {
      throw new TransferError(ErrorCode.PROTOCOL_ERROR, 'Session ID mismatch');
    }

    // Check if this is an invalid chunk response
    if (chunkIndex < 0 || chunkIndex >= this.totalChunks || data.length === 0) {
      throw new TransferError(ErrorCode.INVALID_CHUNK, `Invalid chunk index: ${chunkIndex}`);
    }

    this.log(`Received chunk ${chunkIndex}/${this.totalChunks}`);

    // Store the chunk
    this.chunks.set(chunkIndex, data);

    // Emit chunk event
    if (this.options.onChunk) {
      this.options.onChunk({
        sessionId: this.sessionId,
        timestamp: Date.now(),
        chunkIndex,
        totalChunks: this.totalChunks,
        data
      });
    }

    // Update progress
    this.updateProgress();

    // Check if transfer is complete
    if (nextChunkIndex === -1) {
      await this.completeTransfer();
    } else {
      // Request the next chunk
      this.currentChunkIndex = nextChunkIndex;
      await this.requestNextChunk();
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

  private async requestNextChunk(): Promise<void> {
    if (this.currentChunkIndex >= this.totalChunks) {
      return;
    }

    this.log(`Requesting chunk ${this.currentChunkIndex}`);
    const pullMessage = createPullMessage(
      this.sessionId,
      this.sequenceNumber++,
      this.currentChunkIndex
    );

    await this.sendMessage(pullMessage);
  }

  private updateProgress(): void {
    if (!this.options.onProgress) return;

    const now = Date.now();
    const elapsed = (now - this.prevTime) / 1000; // seconds
    this.prevTime = now;

    const chunkSize = this.options.chunkSize ?? 64;
    const bytesTransferred = chunkSize;
    const receivedChunks = this.chunks.size;
    const percentComplete = (receivedChunks / this.totalChunks) * 100;
    const transferSpeed = elapsed > 0 ? bytesTransferred / elapsed : 0;
    const remainingChunks = this.totalChunks - receivedChunks;
    const estimatedTimeRemaining = transferSpeed > 0 ? (remainingChunks * elapsed) : 0;

    const progress: ProgressEvent = {
      sessionId: this.sessionId,
      fileName: this.fileName,
      fileSize: this.fileSize,
      currentChunk: receivedChunks,
      totalChunks: this.totalChunks,
      percentComplete,
      transferSpeed,
      estimatedTimeRemaining,
      updatedTime: now,
      startedTime: this.prevTime,
      bytesTransferred
    };
    this.options.onProgress(progress);
  }

  private async completeTransfer(): Promise<void> {
    this.log('Transfer completed, assembling file');
    this.state = TransferState.DONE;
    this.stopListening();

    // Verify we have all chunks
    if (this.chunks.size !== this.totalChunks) {
      throw new TransferError(
        ErrorCode.INVALID_CHUNK,
        `Missing chunks: expected ${this.totalChunks}, got ${this.chunks.size}`
      );
    }

    // Assemble chunks in order
    const orderedChunks: Uint8Array[] = [];
    for (let i = 0; i < this.totalChunks; i++) {
      const chunk = this.chunks.get(i);
      if (!chunk) {
        throw new TransferError(ErrorCode.INVALID_CHUNK, `Missing chunk ${i}`);
      }
      orderedChunks.push(chunk);
    }

    const file = assembleFile(orderedChunks, this.fileName, this.mimeType);

    // Verify file size
    if (file.size !== this.fileSize) {
      throw new TransferError(
        ErrorCode.INVALID_CHUNK,
        `File size mismatch: expected ${this.fileSize}, got ${file.size}`
      );
    }

    // Emit done event
    if (this.options.onDone) {
      this.options.onDone({
        sessionId: this.sessionId,
        timestamp: Date.now(),
        file
      });
    }

    if (this.currentResolve) {
      this.currentResolve(file);
      this.currentResolve = null;
      this.currentReject = null;
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
      console.log(`[FileReceiver:${this.sessionId}] ${message}`);
    }
  }
}