"use client";

import { TransferProgress } from "../lib/beam";

interface SessionTableProps {
  data: TransferProgress | null;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function shortenFilename(filename: string, maxLength: number = 30): string {
  if (filename.length <= maxLength) return filename;
  const ext = filename.split('.').pop();
  const name = filename.substring(0, filename.lastIndexOf('.'));
  const shortName = name.substring(0, maxLength - ext!.length - 4) + '...';
  return shortName + '.' + ext;
}

export function SessionTable({ data }: SessionTableProps) {
  let content = (
    <p>
      No active session. Place the two nearby devices so that their screens face each
      other.
    </p>
  );
  if (data != null) {
    console.log("Session: " + JSON.stringify(data));
    content = (
      <div className="relative overflow-x-auto sm:rounded-lg">
        <table className="hidden w-full text-left text-sm text-gray-500 dark:text-gray-400 sm:table rtl:text-right">
          <tbody>
            <tr className="mb-2">
              <th
                scope="row"
                className="whitespace-nowrap py-2 font-medium text-gray-900 dark:bg-gray-800 dark:text-white"
              >
                File name
              </th>
              <td className="px-4 py-2">
                {shortenFilename(data.fileName)}
              </td>
            </tr>
            <tr className="mb-2">
              <th
                scope="row"
                className="whitespace-nowrap py-2 font-medium text-gray-900 dark:bg-gray-800 dark:text-white"
              >
                Size
              </th>
              <td className="px-4 py-2">
                {formatFileSize(data.fileSize)}
              </td>
            </tr>
            <tr className="mb-2">
              <th
                scope="row"
                className="whitespace-nowrap py-2 font-medium text-gray-900 dark:bg-gray-800 dark:text-white"
              >
                Progress
              </th>
              <td className="px-4 py-2">
                {data.percentComplete.toFixed(1)}% ({data.currentChunk}/{data.totalChunks} chunks)
              </td>
            </tr>
            <tr className="mb-2">
              <th
                scope="row"
                className="whitespace-nowrap py-2 font-medium text-gray-900 dark:bg-gray-800 dark:text-white"
              >
                Transfer Speed
              </th>
              <td className="px-4 py-2">
                {formatFileSize(data.transferSpeed)}/s
              </td>
            </tr>
            <tr className="mb-2">
              <th
                scope="row"
                className="whitespace-nowrap py-2 font-medium text-gray-900 dark:bg-gray-800 dark:text-white"
              >
                Time Remaining (est.)
              </th>
              <td className="px-4 py-2">
                {data.estimatedTimeRemaining > 0
                  ? `${Math.ceil(data.estimatedTimeRemaining / 1000)}s`
                  : 'Unknown'}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="block sm:hidden">
          <div className="mb-2">
            <div className="font-medium text-gray-900 dark:text-white">
              File name
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              {shortenFilename(data.fileName)}
            </div>
          </div>
          <div className="mb-2">
            <div className="font-medium text-gray-900 dark:text-white">
              Size
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              {formatFileSize(data.fileSize)}
            </div>
          </div>
          <div className="mb-2">
            <div className="font-medium text-gray-900 dark:text-white">
              Progress
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              {data.percentComplete.toFixed(1)}% ({data.currentChunk}/{data.totalChunks} chunks)
            </div>
          </div>
          <div className="mb-2">
            <div className="font-medium text-gray-900 dark:text-white">
              Transfer Speed
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              {formatFileSize(data.transferSpeed)}/s
            </div>
          </div>
          <div className="py-2">
            <div className="font-medium text-gray-900 dark:text-white">
              Time Remaining (est.)
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              {data.estimatedTimeRemaining > 0
                ? `${Math.ceil(data.estimatedTimeRemaining / 1000)}s`
                : 'Unknown'}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="pt-4">
      <h5 className="my-4 text-xl font-medium text-gray-600 dark:text-gray-400">
        Session
      </h5>
      {content}
    </div>
  );
}
