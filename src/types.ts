export type MessageType = "text" | "image" | "video" | "audio";

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  text?: string;       // Decrypted text message
  mediaUrl?: string;   // Decrypted media Blob URL in browser memory
  fileName?: string;   // Original filename if applicable
  fileSize?: number;   // Original file size in bytes
  timestamp: number;
}

export interface Peer {
  userId: string;
  userName: string;
  connectionState: "connecting" | "connected" | "disconnected";
  webrtcState: "none" | "connecting" | "connected" | "failed";
}

export interface RoomState {
  id: string;
  key: string;
  joined: boolean;
}

// Format of the encrypted payload that is transmitted
export interface EncryptedPayload {
  iv: string;         // Base64 encoded Initialization Vector
  ciphertext: string; // Base64 encoded encrypted data
}
