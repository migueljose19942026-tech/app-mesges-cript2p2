import { EncryptedPayload } from "./types";

// Convert an ArrayBuffer to a Base64 string safely
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert a Base64 string to an ArrayBuffer safely
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Derive a CryptoKey from a human-readable room password using SHA-256
export async function deriveKey(roomKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const data = encoder.encode(roomKey);
  const hash = await crypto.subtle.digest("SHA-256", data);
  
  return crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt string data using the derived CryptoKey
export async function encryptText(text: string, key: CryptoKey): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Generate a random 12-byte IV (Initialization Vector)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
  };
}

// Decrypt encrypted payload and return original string
export async function decryptText(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// Encrypt a file/Blob using the derived CryptoKey
export async function encryptBlob(blob: Blob, key: CryptoKey): Promise<EncryptedPayload> {
  const arrayBuffer = await blob.arrayBuffer();
  
  // Generate a random 12-byte IV (Initialization Vector)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    arrayBuffer
  );
  
  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
  };
}

// Decrypt encrypted payload and return a Blob with the original mime type
export async function decryptBlob(payload: EncryptedPayload, key: CryptoKey, mimeType: string): Promise<Blob> {
  const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  
  return new Blob([decryptedBuffer], { type: mimeType });
}
