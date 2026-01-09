import Image from "next/image";
import { useRef, useState } from "react";
import TransferCard from "./transfer-modal";
import { MdOutlineCallReceived } from "react-icons/md";
import Loader from "./loader";
export default function Component() {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showTransfer, setShowTransfer] = useState(false);

  const handleNewSession = () => {
    setShowTransfer(true);
  };

  const Options = () => {
    const optionStyle = `
          aspect-[2/1] w-full mx-auto  rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200 ease-in-out flex items-center justify-left
         border-gray-300
          hover:border-primary hover:bg-primary/5 bg-gray-100 hover:bg-gray-200
        `;
    return (
      <div className="grid size-full">
        <div
          className="mb-4 flex items-start justify-center transition-colors duration-200"
          onClick={handleNewSession}
        >
          <div className="flex w-full flex-col">
            <div
              className={optionStyle}
            >
              <div className="flex flex-row items-center gap-4">
                <div className="rounded-full bg-blue-600/10 p-3">
                  <MdOutlineCallReceived className="size-10" />
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    Receive new file
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render TransferCard as modal instead of replacing the entire view

  return (
    <>
      <div className="grid" ref={parentRef}>
        <h2 className="py-4 text-2xl font-bold text-gray-800">Receive</h2>
        <div className="grid grid-cols-1 gap-4 pb-8 sm:grid-cols-2">
          <div className="flex flex-1 flex-col justify-start">
            <p className="mb-4">
              Receive files by aligning nearby devices
              front-to-front and scanning QR codes. <br /> Transfer
              speed is low but steadily works completely offline.
            </p>
            <div className="relative hidden sm:block">
              <Image
                src="./beam-receive.png"
                width={500}
                height={400}
                className="h-auto w-full" alt={"Receive"} />
            </div>
          </div>
          <div className="sm:pl-4">
            <Options />
          </div>
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransfer && (
        <Loader role="receiver">
          <TransferCard
            role="receiver"
            isOpen={showTransfer}
            onAbort={() => setShowTransfer(false)}
          />
        </Loader>
      )}
    </>
  );
}
