import { Writer, Reader } from '.';

/**
 * QR Code Writer adapter for Beam library
 * Implements the Writer interface to display QR codes in React components
 */
export class QrCodeWriter implements Writer {
  constructor(private setQrCode: (code: string) => void) { }

  async write(data: string): Promise<void> {
    this.setQrCode(data);
    return Promise.resolve();
  }
}

/**
 * QR Code Reader adapter for Beam library
 * Implements the Reader interface to handle QR code scanning input
 */
export class QrCodeReader implements Reader {
  private onDataCallback?: (data: string) => void;
  private onErrorCallback?: (error: string) => void;
  private isReading = false;

  async read(
    onData: (data: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    this.onDataCallback = onData;
    this.onErrorCallback = onError;
    this.isReading = true;

    // This promise doesn't resolve - the reader stays active
    // until explicitly stopped or an error occurs
    return new Promise<void>((_, reject) => {
      // Store reject function for error handling
      this.rejectPromise = reject;
    });
  }

  private rejectPromise?: (reason: unknown) => void;

  /**
   * Called by QR scanner when a code is detected
   * @param data The decoded QR code data
   */
  input(data: string): void {
    if (this.isReading && this.onDataCallback) {
      this.onDataCallback(data);
    }
  }

  /**
   * Called when an error occurs during scanning
   * @param error The error message
   */
  error(error: string): void {
    if (this.isReading && this.onErrorCallback) {
      this.onErrorCallback(error);
    }
    if (this.rejectPromise) {
      this.rejectPromise(new Error(error));
    }
  }

  /**
   * Stop the reader and clean up
   */
  stop(): void {
    this.isReading = false;
    this.onDataCallback = undefined;
    this.onErrorCallback = undefined;
    this.rejectPromise = undefined;
  }
}