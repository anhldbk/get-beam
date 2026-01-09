'use client';

import { Modal } from 'flowbite-react';
import { MdOutlineCheckCircle } from "react-icons/md";

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export default function CompletionModal({
  isOpen,
  onClose,
  message = "File has been saved to Downloads folder"
}: CompletionModalProps) {
  return (
    <Modal show={isOpen} onClose={onClose} size="md" popup className="backdrop-blur-sm"
    >
      <Modal.Header />
      <Modal.Body>
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <MdOutlineCheckCircle className="size-16 text-green-500" />
          </div>
          <h3 className="mb-2 text-xl font-medium text-gray-900 dark:text-white">
            File Transfer Successful
          </h3>
          <p className="mb-12 text-sm text-gray-500 dark:text-gray-400">
            {message}
          </p>
          <div className="mt-12 flex w-full justify-end">
            <button
              onClick={onClose}
              className="rounded-md bg-green-600 p-8 py-2.5 text-lg font-medium text-white shadow-sm  hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-300 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800"
            >
              Close
            </button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}