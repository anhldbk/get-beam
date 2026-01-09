import { Writer, Reader } from '../types';

export class MockWriter implements Writer {
  public writtenData: string[] = [];

  async write(data: string): Promise<void> {
    this.writtenData.push(data);
  }

  getLastWritten(): string | undefined {
    return this.writtenData[this.writtenData.length - 1];
  }

  clear(): void {
    this.writtenData = [];
  }
}

export class MockReader implements Reader {
  private dataQueue: string[] = [];
  private errorQueue: string[] = [];
  private onDataCallback: ((data: string) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  async read(
    onData: (data: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    this.onDataCallback = onData;
    this.onErrorCallback = onError;
    
    // Process any queued data
    this.processQueue();
  }

  // Method for tests to simulate receiving data
  simulateData(data: string): void {
    if (this.onDataCallback) {
      this.onDataCallback(data);
    } else {
      this.dataQueue.push(data);
    }
  }

  // Method for tests to simulate errors
  simulateError(error: string): void {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    } else {
      this.errorQueue.push(error);
    }
  }

  private processQueue(): void {
    // Process data queue
    while (this.dataQueue.length > 0 && this.onDataCallback) {
      const data = this.dataQueue.shift()!;
      this.onDataCallback(data);
    }

    // Process error queue
    while (this.errorQueue.length > 0 && this.onErrorCallback) {
      const error = this.errorQueue.shift()!;
      this.onErrorCallback(error);
    }
  }

  clear(): void {
    this.dataQueue = [];
    this.errorQueue = [];
  }
}

// Channel class to simulate communication between sender and receiver
export class MockChannel {
  private senderToReceiver: MockReader = new MockReader();
  private receiverToSender: MockReader = new MockReader();
  private senderWriter: MockWriter = new MockWriter();
  private receiverWriter: MockWriter = new MockWriter();

  getSenderIO(): { writer: Writer; reader: Reader } {
    return {
      writer: {
        write: async (data: string) => {
          await this.senderWriter.write(data);
          this.senderToReceiver.simulateData(data);
        }
      },
      reader: this.receiverToSender
    };
  }

  getReceiverIO(): { writer: Writer; reader: Reader } {
    return {
      writer: {
        write: async (data: string) => {
          await this.receiverWriter.write(data);
          this.receiverToSender.simulateData(data);
        }
      },
      reader: this.senderToReceiver
    };
  }

  getSenderData(): string[] {
    return this.senderWriter.writtenData;
  }

  getReceiverData(): string[] {
    return this.receiverWriter.writtenData;
  }

  clear(): void {
    this.senderToReceiver.clear();
    this.receiverToSender.clear();
    this.senderWriter.clear();
    this.receiverWriter.clear();
  }
}