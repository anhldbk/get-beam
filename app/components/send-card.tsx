import Image from "next/image";
import TransferCard from "./transfer-modal";
import { useEffect, useState } from "react";
import { useRef } from "react";
import { GoHistory } from "react-icons/go";
import { MdCallMade } from "react-icons/md";
import { getLastSenderSession, TransferProgress } from "../lib/beam";
import { formatFileSize, shortenFilename } from "../lib/utils/format";
import { defaultFileStorage } from "../lib/beam/file-storage";
import Loader from "./loader";

export default function Component() {
  const [lastSession, setLastSession] = useState<TransferProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [isFileChunksAvailable, setIsFileChunksAvailable] = useState(false);
  const [sessionValidationError, setSessionValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setResumed(false);
    setSessionValidationError(null); // Clear any validation errors
    setShowTransfer(true);
  };

  const handleResumeSession = async () => {
    if (!lastSession) {
      setSessionValidationError("No session found to resume.");
      return;
    }

    // Clear any previous validation errors
    setSessionValidationError(null);

    try {
      // Check if file chunks are available for the session
      const storedFileData = await defaultFileStorage.getFileChunks(lastSession.fileName);

      if (!storedFileData) {
        setSessionValidationError("File data not found. The file may have been cleared. Please select the file again.");
        return;
      }

      // Validate chunk integrity
      const totalSize = storedFileData.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      if (Math.abs(totalSize - lastSession.fileSize) > storedFileData.chunkSize) {
        setSessionValidationError("File data appears corrupted. Please select the file again.");
        return;
      }

      console.log(`Resuming session for ${lastSession.fileName} with ${storedFileData.chunks.length} chunks`);
      setResumed(true);
      setShowTransfer(true);
    } catch (error) {
      console.error("Session validation failed:", error);
      setSessionValidationError("Failed to validate session data. Please try selecting the file again.");
    }
  };

  useEffect(() => {
    (async () => {
      const session = await getLastSenderSession();
      setLastSession(session);

      // Check if file chunks are available for the last session
      if (session) {
        try {
          const storedFileData = await defaultFileStorage.getFileChunks(session.fileName);
          setIsFileChunksAvailable(!!storedFileData);
        } catch (error) {
          console.warn("Failed to check file chunks availability:", error);
          setIsFileChunksAvailable(false);
        }
      } else {
        setIsFileChunksAvailable(false);
      }
    })();
  }, [showTransfer]);

  // Render TransferCard as modal instead of replacing the entire view

  const Options = () => {
    const optionStyle = `
          aspect-[2/1] w-full mx-auto  rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200 ease-in-out flex items-center justify-left
         border-gray-300
          hover:border-primary hover:bg-primary/5 bg-gray-100 hover:bg-gray-200
        `;
    return (
      <div className="grid w-full grid-rows-2">
        {lastSession && (
          <div className="flex flex-col space-y-2">
            <div
              className={`flex items-center justify-center transition-colors duration-200 ${!isFileChunksAvailable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
              onClick={isFileChunksAvailable ? handleResumeSession : undefined}
            >
              <div className="flex w-full flex-col">
                <div
                  className={`${optionStyle} ${!isFileChunksAvailable ? 'hover:border-gray-300 hover:bg-gray-100' : ''
                    }`}
                >
                  <div className="flex flex-row items-center gap-4">
                    <div className="rounded-full bg-blue-600/10 p-3">
                      <GoHistory className="size-10" />
                    </div>
                    <div className="flex flex-col justify-start text-left">
                      <p className="text-lg font-semibold">
                        Resume session
                        {!isFileChunksAvailable && (
                          <span className="ml-2 text-sm text-red-500">(File chunks missing)</span>
                        )}
                      </p>
                      <p className="text-gray-500">
                        {shortenFilename(lastSession.fileName)}
                      </p>
                      <p className="text-gray-500">
                        {formatFileSize(lastSession.fileSize)}
                      </p>
                      {!isFileChunksAvailable && (
                        <p className="text-sm text-red-500">
                          File data not available - please select file again
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Session Validation Error Display */}
            {sessionValidationError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                <div className="flex items-center">
                  <svg className="mr-2 size-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">{sessionValidationError}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div
          className="mb-4 flex items-center justify-center transition-colors duration-200"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelected}
            accept="*/*"
          />
          <div className="flex w-full flex-col">
            <div
              className={optionStyle}
            >
              <div className="flex flex-row items-center gap-4">
                <div className="rounded-full bg-blue-600/10 p-3">
                  <MdCallMade className="size-10" />
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    Send new file
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <>
      <div className="grid">
        <h2 className="py-4 text-2xl font-bold text-gray-800">Send</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-1 flex-col">
            <p className="mb-4">
              Share files between nearby devices with
              front cameras using QR codes - no internet
              or accounts required.
            </p>
            <div className="relative hidden sm:block">
              <Image
                src="./beam-send.png"
                alt="Send"
                width={500}
                height={400}
                className="h-auto w-full"
              />
            </div>
          </div>
          <div className="sm:pl-4">
            <Options />
          </div>
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransfer && (
        <Loader role="sender" file={selectedFile} resumed={resumed}>
          <TransferCard
            role="sender"
            file={selectedFile}
            resumed={resumed}
            isOpen={showTransfer}
            onAbort={() => setShowTransfer(false)}
          />
        </Loader>
      )}
    </>
  );
}
