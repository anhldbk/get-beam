import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CiCircleRemove } from "react-icons/ci";
import { Modal } from "flowbite-react";
import {
  FileSender,
  FileReceiver,
  TransferOptions,
  TransferProgress,
  TransferState,
  saveSenderSession,
  saveReceiverSession,
  getLastSenderSession
} from "../lib/beam";
import { defaultFileStorage } from "../lib/beam/file-storage";
import { QrCodeWriter, QrCodeReader } from "../lib/beam/adapters";
import { VISION_QR_FPS } from "../settings";
import { SessionTable } from "./session-table";
import CompletionModal from "./completion-modal";

interface TransferCardProps {
  role: "sender" | "receiver";
  onAbort: () => void;
  file?: File | null; // Add file prop for sender
  resumed?: boolean; // Add resumed prop for session resumption
  isOpen: boolean; // Add isOpen prop for modal visibility
}

const QR_CODE_READER_ID = "reader";

// QrQueueInterface replaced by QrCodeWriter/QrCodeReader adapters

export default function TransferCard({ onAbort, role, file, resumed, isOpen }: TransferCardProps) {
  const [qrCode, setQrCode] = useState("Hello there");
  const [qrCodeSize, setQrCodeSize] = useState(800);
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [, setTransferState] = useState<TransferState>(TransferState.IDLE);
  const [cameraSession, setCameraSession] = useState<"ready" | "notReady">(
    "notReady",
  );
  const qrCodeContainerRef = useRef<HTMLDivElement>(null);
  const cameraContainerRef = useRef<HTMLDivElement>(null);
  const transferCardRef = useRef<HTMLDivElement>(null);
  const qrCodeReader = useRef<Html5Qrcode | null>(null);
  const [fileSender, setFileSender] = useState<FileSender | null>(null);
  const [fileReceiver, setFileReceiver] = useState<FileReceiver | null>(null);
  const qrReader = useRef<QrCodeReader | null>(null);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const hasInitialized = useRef(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStoringChunks, setIsStoringChunks] = useState(false);

  // Helper function to save session progress
  const saveSessionProgress = useCallback(async (progress: TransferProgress) => {
    try {
      if (role === 'sender') {
        await saveSenderSession(progress);
      } else {
        await saveReceiverSession(progress);
      }
    } catch (error) {
      console.warn('Failed to save session progress:', error);
      // Don't throw - session saving is non-critical
    }
  }, [role]);

  // Transfer options for Beam
  const transferOptions: TransferOptions = useMemo(() => ({
    chunkSize: 64,
    enableLogging: true,
    onHandshake: async (event) => {
      console.log('Handshake completed:', event);
      setTransferState(TransferState.HANDSHAKE);

      // For new sender sessions, save initial session data to enable resumption
      // This creates the link between the session ID and file chunks stored in IndexedDB
      if (role === 'sender' && !resumed) {
        try {
          const initialProgress: TransferProgress = {
            sessionId: event.sessionId,
            fileName: event.fileName,
            fileSize: event.fileSize,
            currentChunk: 0,
            totalChunks: event.totalChunks,
            percentComplete: 0,
            transferSpeed: 0,
            estimatedTimeRemaining: 0,
            updatedTime: event.timestamp,
            startedTime: event.timestamp,
            bytesTransferred: 0
          };

          await saveSenderSession(initialProgress);
          console.log(`Saved initial resumable session data for ${event.fileName} (Session: ${event.sessionId})`);
        } catch (error) {
          console.warn('Failed to save initial session data:', error);
          // Non-critical error - transfer can continue without resumability
        }
      }
    },
    onChunk: (event) => {
      console.log('Chunk processed:', event.chunkIndex);
      setTransferState(TransferState.TRANSFER);
    },
    onDone: (event) => {
      console.log('Transfer completed');
      setTransferState(TransferState.DONE);

      if (event.file && role === 'receiver') {
        downloadFile(event.file);
      }

      // Add some delay to ensure the last chunk can be read
      setTimeout(() => {
        // Stop QR scanner to prevent additional messages
        if (qrCodeReader.current?.isScanning) {
          qrCodeReader.current.stop().catch(console.error);
        }

        // Stop QR reader adapter
        if (qrReader.current) {
          qrReader.current.stop();
        }
        // Show completion modal
        setShowCompletionModal(true);
      }, 2000);
    },
    onError: (error) => {
      console.error('Transfer error:', error);
      setTransferState(TransferState.ERROR);

      // Stop QR scanner on error to prevent additional messages
      if (qrCodeReader.current?.isScanning) {
        qrCodeReader.current.stop().catch(console.error);
      }

      // Stop QR reader adapter
      if (qrReader.current) {
        qrReader.current.stop();
      }
    },
    onProgress: (progress) => {
      console.log('Transfer progress:', progress);
      setTransferProgress(progress);
      saveSessionProgress(progress);
    }

  }), [role, saveSessionProgress, resumed]);

  const adjustSizes = useCallback(() => {
    console.log('🔧 adjustSizes() called');

    // Set QR code size based on its container dimensions
    if (qrCodeContainerRef.current) {
      const containerRect = qrCodeContainerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight

      console.log('📏 Container dimensions:', {
        containerWidth,
        containerHeight,
        windowWidth,
        windowHeight
      });

      // Check if container has meaningful dimensions (layout is ready)
      if (containerWidth <= 10 || containerHeight <= 10) {
        console.log('⏳ Container not ready, retrying...');
        // Layout not ready yet, retry after a short delay
        window.setTimeout(() => adjustSizes(), 50);
        return;
      }

      const isLargeScreen = window.innerWidth >= 1024; // lg breakpoint where grid becomes 3 columns
      const titleHeight = window.innerWidth >= 768 ? 60 : 0; // Title is hidden on mobile
      const availableContainerHeight = containerHeight - titleHeight;
      const availableWindowHeight = windowHeight / 2;

      console.log('📱 Screen info:', {
        isLargeScreen,
        titleHeight,
        availableContainerHeight,
        availableWindowHeight
      });

      let size;
      if (isLargeScreen) {
        // On large screens, the QR container spans 2 columns of a 3-column grid
        // Make QR code as large as possible - use almost all available space
        const padding = 40;
        const usableWidth = containerWidth - padding;
        const usableHeight = availableContainerHeight - padding;

        console.log('💻 Large screen calculations:', {
          usableWidth,
          usableHeight,
          minSize: Math.min(usableWidth, usableHeight)
        });

        // Use the maximum possible size while maintaining square aspect ratio
        size = Math.min(usableWidth, usableHeight);

        // Ensure it's large enough to be useful but not exceeding reasonable limits
        // size = Math.max(size, 400); // Minimum for readability
        // size = Math.min(size, 1000); // Maximum reasonable size
      } else {
        // On smaller screens (mobile/tablet), QR should match camera feed width
        // The camera feed uses w-full, so QR should also use the full container width
        const padding = 0; // Small padding to match camera styling
        const usableWidth = containerWidth - padding;
        const usableHeight = Math.max(availableContainerHeight, availableWindowHeight);

        // Make QR code width match the container width (same as camera feed)
        // but limit height to keep it square and visible
        size = Math.min(usableWidth, usableHeight);

        console.log('📱 Mobile/tablet calculations:', {
          containerWidth,
          usableWidth,
          size
        });
      }

      const finalSize = Math.floor(size);
      console.log('✅ Final QR size set to:', finalSize);
      setQrCodeSize(finalSize);
      return;
    }

    // Fallback when container is not available
    console.log('⚠️ Container not available, using fallback');
    const isLargeScreen = window.innerWidth >= 1024;
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      const availableWidth = window.innerWidth - 64; // Account for modal padding
      const availableHeight = window.innerHeight - 200; // Account for header/footer
      const size = Math.min(availableWidth * 0.9, availableHeight * 0.7);
      const finalSize = Math.max(size, 250);
      console.log('📱 Mobile fallback size:', finalSize);
      setQrCodeSize(finalSize);
    } else if (isLargeScreen) {
      // For large screens, make it as large as possible
      const estimatedWidth = (window.innerWidth * 0.8) * (2 / 3); // Modal width * column span ratio
      const finalSize = Math.min(estimatedWidth * 0.95, 900);
      console.log('💻 Large screen fallback size:', finalSize);
      setQrCodeSize(finalSize);
    } else {
      console.log('📺 Medium screen fallback size: 450');
      setQrCodeSize(450); // Medium screen default
    }
  }, []);
  // Size observer effect with resize listener and container observer
  useEffect(() => {
    // Use requestAnimationFrame to ensure layout is complete before measuring
    const rafId = requestAnimationFrame(() => {
      // Add a small additional delay to ensure grid layout is fully calculated
      window.setTimeout(() => adjustSizes(), 10);
    });

    // Debounced resize handler to prevent excessive recalculations
    let resizeTimeout: number;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        adjustSizes();
      }, 100); // Debounce resize events by 100ms
    };

    window.addEventListener('resize', handleResize);

    // Set up ResizeObserver for both QR code and camera containers
    let qrResizeObserver: ResizeObserver | null = null;
    let cameraResizeObserver: ResizeObserver | null = null;

    if (qrCodeContainerRef.current) {
      qrResizeObserver = new ResizeObserver(() => {
        // Debounce ResizeObserver callbacks as well
        clearTimeout(resizeTimeout);
        resizeTimeout = window.setTimeout(() => {
          adjustSizes();
        }, 50);
      });
      qrResizeObserver.observe(qrCodeContainerRef.current);
    }

    if (cameraContainerRef.current) {
      cameraResizeObserver = new ResizeObserver(() => {
        clearTimeout(resizeTimeout);
        resizeTimeout = window.setTimeout(() => {
          adjustSizes();
        }, 50);
      });
      cameraResizeObserver.observe(cameraContainerRef.current);
    }

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      if (qrResizeObserver) {
        qrResizeObserver.disconnect();
      }
      if (cameraResizeObserver) {
        cameraResizeObserver.disconnect();
      }
    };
  }, [isOpen, adjustSizes]); // Add isOpen as dependency to recalculate when modal opens


  const releaseWakeLock = useCallback(async () => {
    if (wakeLock) {
      try {
        await wakeLock.release();
        setWakeLock(null);
        console.log("Wake Lock released");
      } catch (err) {
        console.log("Failed to release Wake Lock:", err);
      }
    }
  }, [wakeLock]);

  const handleAbort = useCallback(() => {
    console.log("page> Aborted");

    // Prevent multiple abort calls
    if (hasInitialized.current === false) {
      return;
    }

    // Cancel current transfers - check if cancellation is possible
    if (fileSender) {
      try {
        fileSender.cancel();
      } catch (error) {
        console.warn("Failed to cancel sender:", error);
      }
      setFileSender(null);
    }
    if (fileReceiver) {
      try {
        fileReceiver.cancel();
      } catch (error) {
        console.warn("Failed to cancel receiver:", error);
      }
      setFileReceiver(null);
    }

    // Stop QR reader
    if (qrReader.current) {
      console.log("page> Stopping QR reader");
      qrReader.current.stop();
      qrReader.current = null;
    }

    // Release wake lock
    releaseWakeLock();

    // Reset state in batched update to prevent multiple renders
    setTimeout(() => {
      setCameraSession("notReady");
      setTransferState(TransferState.CANCELLED);
      hasInitialized.current = false; // Reset initialization flag
      onAbort();
    }, 0);
  }, [fileSender, fileReceiver, releaseWakeLock, onAbort]);

  const getTitle = () => {
    if (role == "sender") {
      return "Sending...";
    }
    return "Receiving...";
  };

  const requestCameraAccess = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => setCameraSession("ready"))
      .catch(() => setCameraSession("notReady"));
  };

  const initializeQrScanner = useCallback(() => {
    if (qrCodeReader.current?.getState() || cameraSession !== "ready") return;
    qrCodeReader.current = new Html5Qrcode(QR_CODE_READER_ID);
    qrCodeReader.current.start(
      { facingMode: "user" },
      {
        fps: VISION_QR_FPS,
      },
      (decodedText: string) => {
        // Send scanned data to QR reader adapter
        if (qrReader.current) {
          qrReader.current.input(decodedText);
        }
      },
      undefined // Error callback
    ).catch(console.error);
  }, [cameraSession]);

  // Request camera access when modal opens
  useEffect(() => {
    if (isOpen) {
      requestCameraAccess();
    }
  }, [isOpen]);

  const downloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    console.log("Receiver> downloaded");
  };

  const startSending = useCallback(async () => {
    if (fileSender != null) {
      console.log("page> A sender is already running");
      return;
    }

    // Clear any previous error messages
    setErrorMessage(null);

    try {
      if (resumed) {
        // Handle resumed session
        console.log("page> Resuming sender session");

        // Get the last sender session data
        const lastSession = await getLastSenderSession();
        if (!lastSession) {
          setErrorMessage("No session found to resume. Please select a new file.");
          return;
        }

        // Create resumable session data from stored file chunks
        const sessionData = await FileSender.createResumableSession(
          lastSession.fileName,
          lastSession.sessionId,
          lastSession.currentChunk,
          defaultFileStorage
        );

        if (!sessionData) {
          setErrorMessage("File chunks not found. The file may have been cleared or corrupted. Please select the file again.");
          return;
        }

        setTransferState(TransferState.HANDSHAKE);

        // Create QR writer and reader
        const writer = new QrCodeWriter(setQrCode);
        const reader = new QrCodeReader();
        qrReader.current = reader;

        // Create sender for resumable session
        const sender = new FileSender(writer, reader, transferOptions, defaultFileStorage);
        setFileSender(sender);

        console.log(`page> Resuming send for ${sessionData.fileName} from chunk ${sessionData.sentChunks}`);
        await sender.sendResumable(sessionData);

        console.log("page> Resumed send completed");
      } else {
        // Handle new file transfer
        if (!file) {
          setErrorMessage("No file selected for transfer.");
          return;
        }

        console.log("page> Starting new file transfer");
        setIsStoringChunks(true);

        setTransferState(TransferState.HANDSHAKE);

        // Create QR writer and reader
        const writer = new QrCodeWriter(setQrCode);
        const reader = new QrCodeReader();
        qrReader.current = reader;

        // Create sender with file storage for resumability
        const sender = new FileSender(writer, reader, transferOptions, defaultFileStorage);
        setFileSender(sender);

        console.log(`page> Starting send for ${file.name} (${file.size} bytes)`);
        setIsStoringChunks(false);
        await sender.send(file);

        console.log("page> Send completed");
      }
    } catch (error) {
      console.error("Send failed:", error);
      setTransferState(TransferState.ERROR);
      setIsStoringChunks(false);

      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('integrity validation')) {
          setErrorMessage("File data is corrupted. Please select the file again.");
        } else if (error.message.includes('Storage not available')) {
          setErrorMessage("Browser storage is not available. Resume functionality will be limited.");
        } else {
          setErrorMessage(`Transfer failed: ${error.message}`);
        }
      } else {
        setErrorMessage("An unexpected error occurred during transfer.");
      }
    }
  }, [file, fileSender, setTransferState, transferOptions, resumed]);

  const startReceiving = useCallback(async () => {
    if (fileReceiver != null) {
      console.log("page> A receiver is already running");
      return;
    }

    try {
      setTransferState(TransferState.HANDSHAKE);

      // Create QR writer and reader
      const writer = new QrCodeWriter(setQrCode);
      const reader = new QrCodeReader();
      qrReader.current = reader;

      // Create receiver with progress tracking
      const receiver = new FileReceiver(writer, reader, transferOptions);

      setFileReceiver(receiver);
      console.log("page> Starting receive");

      const receivedFile = await receiver.receive();

      console.log(`page> Received: ${receivedFile.name}`);
      // The downloadFile call is handled in transferOptions.onDone
    } catch (error) {
      console.error("Receive failed:", error);
      setTransferState(TransferState.ERROR);
    }
  }, [fileReceiver, setTransferState, transferOptions]);

  const initRole = useCallback(async () => {
    // Prevent multiple initializations
    if (hasInitialized.current) {
      console.log("Transfer already initialized, skipping");
      return;
    }

    hasInitialized.current = true;

    if (role === "sender") {
      await startSending();
    } else {
      await startReceiving();
    }
  }, [role, startSending, startReceiving]);

  // Initialize transfer when modal is open and camera is ready
  useEffect(() => {
    if (isOpen && cameraSession === "ready") {
      initializeQrScanner();
      initRole();
    }

    // Cleanup when modal closes
    return () => {
      if (!isOpen && qrCodeReader.current?.isScanning) {
        qrCodeReader.current.stop().catch(console.error);
      }
    };
  }, [isOpen, cameraSession, initializeQrScanner, initRole]);

  // Request wake lock when camera is ready
  useEffect(() => {
    let currentWakeLock: WakeLockSentinel | null = null;

    if (cameraSession === "ready") {
      navigator.wakeLock.request("screen")
        .then((lock) => {
          currentWakeLock = lock;
          setWakeLock(lock);
          console.log("Wake Lock is active");
        })
        .catch((err) => {
          console.log("Wake Lock request failed:", err);
        });
    }

    return () => {
      // Release the local wake lock reference to avoid dependency issues
      if (currentWakeLock) {
        currentWakeLock.release().catch(console.error);
        console.log("Wake Lock released");
      }
      setWakeLock(null);
    };
  }, [cameraSession]);

  const renderCamera = () => (
    <div ref={cameraContainerRef} className="flex w-full flex-col">
      <h5 className="mb-4 hidden text-lg font-medium text-gray-600 dark:text-gray-400 md:block">
        Camera input
      </h5>
      {cameraSession === "ready"
        ? (
          <div className="w-full overflow-hidden">
            <div
              id={QR_CODE_READER_ID}
              style={{
                width: "100%",
                // maxHeight: (cameraSize / CAMERA_ASPECT_RATIO) + "px",
                // overflow: "hidden",
              }}
            />
          </div>
        )
        : (
          <div
            className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-red-300 p-8 text-red-500"
            style={{ height: "200px" }}
            onClick={requestCameraAccess}
          >
            <CiCircleRemove size={40} />
            <p className="mt-2 text-center">Please grant access to camera</p>
            <p className="text-sm text-gray-500">Click to request permission</p>
          </div>
        )}
    </div>
  );

  return (
    <>
      <Modal
        show={isOpen}
        onClose={handleAbort}
        size="8xl"
        popup
        className="backdrop-blur-sm"
        theme={{
          content: {
            base: "flex h-screen w-screen items-center justify-center p-0 md:size-full md:p-4",
            inner: "relative flex size-full flex-col bg-white shadow dark:bg-gray-700 md:rounded-lg"
          },
          root: {
            base: "fixed inset-0 z-50 overflow-hidden md:inset-0 md:overflow-y-auto md:overflow-x-hidden",
            show: {
              on: "flex items-center justify-center bg-gray-900 bg-opacity-0 md:bg-opacity-75 dark:md:bg-opacity-80",
              off: "hidden"
            }
          },
          "header": {
            "base": "hidden items-start justify-between rounded-t border-b p-5 dark:border-gray-600 md:flex",
            "popup": "border-b-0 p-2",
            "title": "text-xl font-medium text-gray-900 dark:text-white",
            "close": {
              "base": "ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white",
              "icon": "size-5"
            }
          }
        }}
      >
        <Modal.Header>
          <div className="px-2 py-4  text-xl font-semibold text-gray-900 dark:text-white">
            {getTitle()}
          </div>
        </Modal.Header>
        <Modal.Body className="p-4">
          {/* Mobile close button */}
          <button
            onClick={handleAbort}
            className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 dark:bg-red-700 dark:hover:bg-red-800 dark:focus:ring-red-900 md:hidden"
            aria-label="Close"
          >
            <svg className="size-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
            </svg>
          </button>

          <div ref={transferCardRef} className="size-full flex-1">
            <div id="mainContent" className="flex h-full flex-col space-y-4 md:space-y-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
              {/* QR Code Section */}
              <div ref={qrCodeContainerRef} className="flex flex-col lg:col-span-2">
                <h5 className="mb-4 hidden text-lg font-medium text-gray-600 dark:text-gray-400 md:block">
                  Screen output
                </h5>
                <div className="flex flex-1 items-start justify-start rounded-lg bg-white">
                  <QRCodeSVG
                    value={qrCode}
                    level="Q"
                    minVersion={1}
                    size={qrCodeSize}
                  />
                </div>
              </div>

              {/* Camera and Session Section */}
              <div className="flex flex-col space-y-4">
                {renderCamera()}

                {/* Error Message Display */}
                {errorMessage && (
                  <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900 dark:text-red-300">
                    <div className="flex items-center">
                      <svg className="mr-2 size-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium">{errorMessage}</span>
                    </div>
                  </div>
                )}

                {/* Chunk Storage Status */}
                {isStoringChunks && (
                  <div className="w-full rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800 dark:border-blue-800 dark:bg-blue-900 dark:text-blue-300">
                    <div className="flex items-center">
                      <svg className="mr-2 size-5 animate-spin" fill="none" viewBox="0 0 20 20">
                        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
                        <path d="M10 3v4M10 13v4M3 10h4M13 10h4" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      <span className="text-sm font-medium">Preparing file for transfer...</span>
                    </div>
                  </div>
                )}

                <SessionTable data={transferProgress} />
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="hidden md:block">
          <div className="flex w-full justify-end">
            <button
              onClick={handleAbort}
              className="rounded-md bg-red-600 p-8 py-2.5 text-lg font-medium text-white shadow-sm  hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-800"
            >
              Abort Transfer
            </button>
          </div>
        </Modal.Footer>
      </Modal>

      <CompletionModal
        isOpen={showCompletionModal}
        onClose={() => {
          setShowCompletionModal(false);
          onAbort(); // Return to home page
        }}
        message="File has been saved to Downloads folder"
      />
    </>
  );
}
