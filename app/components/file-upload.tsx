"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AiOutlineFile } from "react-icons/ai";
import { formatFileSize } from "../lib/utils/format";
import { GoPlusCircle } from "react-icons/go";
interface FileUploadProps {
  onFileChange?: (file: File | null) => void;
}

export default function FileUpload({ onFileChange }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFile = acceptedFiles[0] || null;
    setFile(newFile);
    onFileChange?.(newFile);
  }, [onFileChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 1024 * 1024 * 1024, // 1GB
    multiple: false,
  });

  return (
    <div className="flex w-full flex-col">
      <div
        {...getRootProps()}
        className={`mx-auto flex aspect-[2/1] w-full cursor-pointer items-center justify-start rounded-lg border bg-gray-100 p-6 text-center transition-colors duration-200 ease-in-out ${isDragActive ? "border-indigo-600 bg-indigo-50" : "border-gray-300"} hover:border-indigo-600 hover:bg-indigo-50`}
      >
        <input {...getInputProps()} />
        {file
          ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-indigo-100 p-3">
                <AiOutlineFile className="size-12 text-indigo-600" />
              </div>
              <div className="text-center">
                <p className="max-w-[250px] truncate text-lg font-semibold">
                  {file.name}
                </p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                onClick={() => setFile(null)}
                className="my-2 me-2 rounded-lg border border-purple-700 bg-transparent px-5 py-2.5 text-center text-sm font-medium text-purple-700 hover:bg-purple-800 hover:text-white focus:outline-none focus:ring-4 focus:ring-purple-300 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-500 dark:hover:text-white dark:focus:ring-purple-900"
              >
                Remove file
              </button>
            </div>
          )
          : (
            <div className="flex flex-row items-center gap-4">
              <div className="rounded-full bg-indigo-100 p-3">
                <GoPlusCircle className="size-10" />
              </div>
              <div>
                <p className="text-lg font-semibold">Send new file</p>
                {
                  /* <br />
              <p className="text-sm text-muted-foreground">or continue with the previous one</p>
              <p className="text-sm text-muted-foreground">(data.txt)</p>
              <br /> */
                }
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
