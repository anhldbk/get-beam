import { blake3 } from "@noble/hashes/blake3";

export function getHash(
  input: Uint8Array,
  reduced: boolean = true,
): Uint8Array {
  const hash = blake3(input);
  if (reduced) return hash.slice(0, 8);
  return hash;
}

export function compareBytes(src: Uint8Array, dst: Uint8Array): boolean {
  if (src.length != dst.length) {
    return false;
  }
  for (let i = 0; i < src.length; i++) {
    if (src[i] != dst[i]) {
      return false;
    }
  }
  return true;
}
