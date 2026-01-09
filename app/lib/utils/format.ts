export function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} bytes`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Shorten a filename to specified length while preserving extension
 * @param filename Original filename (e.g. "very_long_filename.txt")
 * @param maxLength Maximum length of the shortened name (e.g. 15)
 * @returns Shortened filename (e.g. "very...name.txt")
 */
export function shortenFilename(
  filename: string,
  maxLength: number = 40,
): string {
  if (filename.length <= maxLength) {
    return filename;
  }

  const extension = filename.lastIndexOf(".") > -1
    ? filename.substring(filename.lastIndexOf("."))
    : "";

  const name = filename.substring(0, filename.length - extension.length);

  if (maxLength <= extension.length + 5) { // 5 = 2 chars + "..."
    return filename.substring(0, maxLength - 3) + "...";
  }

  const charsToShow = maxLength - extension.length - 3; // 3 for "..."
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);

  return name.substring(0, frontChars) +
    "..." +
    name.substring(name.length - backChars) +
    extension;
}
