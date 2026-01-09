export function bytesToString(
  input: Uint8Array,
  format: string = "utf-8",
): string {
  // Use TextDecoder to decode the Uint8Array to a string
  const decoder = new TextDecoder(format);
  return decoder.decode(input);
}

export function stringToBytes(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

// write a function to convert Uint8Array into base64 string
export function bytesToBase64(input: Uint8Array): string {
  return btoa(String.fromCharCode.apply(null, Array.from(input)));
}

// write a function to decode a base64 string and return Uint8Array
export function base64ToBytes(input: string): Uint8Array {
  return new Uint8Array(
    atob(input).split("").map((char) => char.charCodeAt(0)),
  );
}

export function stringToBlob(str: string): Blob {
  return new Blob([str], { type: "text/plain" });
}

export async function blobToString(blob: Blob): Promise<string> {
  const text = await blob.text();
  return Promise.resolve(text);
}
// helper function
// @ts-expect-error TypeScript cannot infer the precise return type for generic typed array conversion
export function toTypedArray(src, type) {
  const buffer = new ArrayBuffer(src.byteLength);
  new src.constructor(buffer).set(src);
  return new type(buffer);
}
