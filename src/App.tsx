import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Paperclip,
  Image,
  Video,
  Lock,
  Users,
  AlertCircle,
  X,
  FileText,
  ShieldAlert,
  Download,
  CheckCircle,
  HelpCircle,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Plus,
  Mic
} from "lucide-react";
import { ChatMessage, Peer, RoomState, EncryptedPayload, MessageType } from "./types";
import { deriveKey, encryptText, decryptText, encryptBlob, decryptBlob } from "./crypto";
import VoiceRecorder from "./components/VoiceRecorder";
import MediaMessage from "./components/MediaMessage";
import RoomCreator from "./components/RoomCreator";
import RoomHeader from "./components/RoomHeader";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function App() {
  // Routing & Authentication State
  const [userName, setUserName] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [localUserId] = useState(() => crypto.randomUUID());

  // Connection states
  const [socketConnected, setSocketConnected] = useState(false);
  const [connectionType, setConnectionType] = useState<"none" | "connecting" | "webrtc" | "websocket">("none");
  const [peers, setPeers] = useState<Peer[]>([]);

  // Crypto state
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

  // Messages & UI states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isEncryptingAndSending, setIsEncryptingAndSending] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  // Refs for WebSockets and WebRTC
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Read URL on mount to check if joining from a shared link
  useEffect(() => {
    const handleUrlHash = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith("#/room/")) {
        try {
          // Extract room ID and key
          // Hash format: #/room/ROOM_ID#key=ROOM_KEY
          const parts = hash.split("#");
          const roomIdPart = parts[1]; // "/room/ROOM_ID"
          const keyPart = parts[2]; // "key=ROOM_KEY"

          const roomId = roomIdPart.replace("/room/", "");
          const roomKey = keyPart && keyPart.startsWith("key=") ? keyPart.replace("key=", "") : "";

          if (roomId && roomKey) {
            setRoom({
              id: roomId,
              key: roomKey,
              joined: false,
            });
            setShowWelcome(false);
          }
        } catch (err) {
          console.error("Error parsing shared link:", err);
        }
      }
    };

    handleUrlHash();
    window.addEventListener("hashchange", handleUrlHash);
    return () => window.removeEventListener("hashchange", handleUrlHash);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle WebSocket Connection and WebRTC signaling when room state changes
  useEffect(() => {
    if (!room || !room.joined || !userName.trim()) return;

    // 1. Derive Cryptographic Key from room.key inside local browser
    const initCrypto = async () => {
      try {
        const key = await deriveKey(room.key);
        setCryptoKey(key);
      } catch (err) {
        console.error("Error deriving crypto key:", err);
      }
    };
    initCrypto();

    // 2. Open WebSocket for signaling & fallback messaging
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    
    setConnectionType("connecting");
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setSocketConnected(true);
      // Join the room on the server
      socket.send(
        JSON.stringify({
          type: "join",
          roomId: room.id,
          userId: localUserId,
          userName: userName.trim(),
        })
      );
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case "room-info": {
            // Received list of peers already in the room
            const initialPeers: Peer[] = data.peers.map((p: any) => ({
              userId: p.userId,
              userName: p.userName,
              connectionState: "connected",
              webrtcState: "none",
            }));
            setPeers(initialPeers);

            // If peers are present, we attempt to initiate a WebRTC connection with them.
            // To prevent double offers, the peer with the lexicographically higher ID initiates.
            initialPeers.forEach((peer) => {
              if (localUserId > peer.userId) {
                initiateWebRTC(peer.userId, socket);
              }
            });

            // If there's already a peer, we wait for WebRTC or fall back to WS
            if (initialPeers.length > 0) {
              // Wait 3.5 seconds. If WebRTC doesn't connect, switch to WebSocket fallback
              setTimeout(() => {
                setConnectionType((current) => {
                  if (current === "connecting") {
                    return "websocket";
                  }
                  return current;
                });
              }, 3500);
            } else {
              // We are the first ones in the room, wait for others to join
              setConnectionType("websocket");
            }
            break;
          }

          case "peer-joined": {
            // A new peer connected
            const newPeer: Peer = {
              userId: data.userId,
              userName: data.userName,
              connectionState: "connected",
              webrtcState: "none",
            };
            setPeers((prev) => {
              if (prev.some((p) => p.userId === data.userId)) return prev;
              return [...prev, newPeer];
            });

            // Log system message
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                senderId: "system",
                senderName: "Sistema",
                type: "text",
                text: `${data.userName} se ha conectado de forma segura.`,
                timestamp: Date.now(),
              },
            ]);

            // Sync chat history to the newly joined peer
            // (We encrypt current history and send it so they are up to date!)
            if (messages.length > 0) {
              syncHistoryToPeer(data.userId, socket);
            }

            // Let the initiator connect WebRTC
            if (localUserId > data.userId) {
              initiateWebRTC(data.userId, socket);
            }
            break;
          }

          case "peer-left": {
            setPeers((prev) => prev.filter((p) => p.userId !== data.userId));
            
            // Cleanup WebRTC connection
            const pc = peerConnections.current.get(data.userId);
            if (pc) {
              pc.close();
              peerConnections.current.delete(data.userId);
            }
            dataChannels.current.delete(data.userId);

            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                senderId: "system",
                senderName: "Sistema",
                type: "text",
                text: `Un usuario se ha desconectado.`,
                timestamp: Date.now(),
              },
            ]);

            // Check if any peer is still WebRTC connected
            updateOverallConnectionType();
            break;
          }

          case "signal": {
            // WebRTC signaling relay
            handleWebRTCSignal(data.senderId, data.payload, socket);
            break;
          }

          case "relay": {
            // WebSocket encrypted message fallback
            handleReceivedEncryptedMessage(data.senderId, data.senderName, data.payload);
            break;
          }
        }
      } catch (err) {
        console.error("Error processing incoming WebSocket message:", err);
      }
    };

    socket.onclose = () => {
      setSocketConnected(false);
      setConnectionType("none");
    };

    return () => {
      socket.close();
      wsRef.current = null;
      // Close all PeerConnections
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      dataChannels.current.clear();
    };
  }, [room, userName]);

  // Setup WebRTC connection as the initiator
  const initiateWebRTC = async (targetUserId: string, socket: WebSocket) => {
    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnections.current.set(targetUserId, pc);

      // Create RTCDataChannel
      const dc = pc.createDataChannel("chat", { ordered: true });
      setupDataChannel(targetUserId, dc);

      // ICE candidates handling
      pc.onicecandidate = (event) => {
        if (event.candidate && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "signal",
              roomId: room?.id,
              userId: localUserId,
              userName,
              targetUserId,
              payload: { candidate: event.candidate },
            })
          );
        }
      };

      // Create Offer SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "signal",
            roomId: room?.id,
            userId: localUserId,
            userName,
            targetUserId,
            payload: { sdp: pc.localDescription },
          })
        );
      }

      setPeers((prev) =>
        prev.map((p) => (p.userId === targetUserId ? { ...p, webrtcState: "connecting" } : p))
      );
    } catch (err) {
      console.error("Failed to initiate WebRTC with:", targetUserId, err);
    }
  };

  // Handle incoming WebRTC signal (SDP Offer/Answer or ICE Candidate)
  const handleWebRTCSignal = async (senderId: string, signal: any, socket: WebSocket) => {
    try {
      let pc = peerConnections.current.get(senderId);

      // If peer connection does not exist, create it (Receiver role)
      if (!pc) {
        pc = new RTCPeerConnection(RTC_CONFIG);
        peerConnections.current.set(senderId, pc);

        pc.onicecandidate = (event) => {
          if (event.candidate && socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: "signal",
                roomId: room?.id,
                userId: localUserId,
                userName,
                targetUserId: senderId,
                payload: { candidate: event.candidate },
              })
            );
          }
        };

        // Listen for remote data channels
        pc.ondatachannel = (event) => {
          setupDataChannel(senderId, event.channel);
        };

        setPeers((prev) =>
          prev.map((p) => (p.userId === senderId ? { ...p, webrtcState: "connecting" } : p))
        );
      }

      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        
        if (signal.sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: "signal",
                roomId: room?.id,
                userId: localUserId,
                userName,
                targetUserId: senderId,
                payload: { sdp: pc.localDescription },
              })
            );
          }
        }
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.error("Error handling WebRTC signal:", err);
    }
  };

  // Setup Event Listeners for RTCOpenDataChannel
  const setupDataChannel = (peerId: string, dc: RTCDataChannel) => {
    dataChannels.current.set(peerId, dc);

    dc.onopen = () => {
      setPeers((prev) =>
        prev.map((p) => (p.userId === peerId ? { ...p, webrtcState: "connected" } : p))
      );
      updateOverallConnectionType();
    };

    dc.onclose = () => {
      dataChannels.current.delete(peerId);
      setPeers((prev) =>
        prev.map((p) => (p.userId === peerId ? { ...p, webrtcState: "failed" } : p))
      );
      updateOverallConnectionType();
    };

    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "encrypted-message") {
          handleReceivedEncryptedMessage(peerId, data.senderName, data.payload);
        } else if (data.type === "sync-history") {
          handleReceivedSyncHistory(data.payload);
        }
      } catch (err) {
        console.error("Error parsing data channel message:", err);
      }
    };
  };

  // Dynamically calculate the active connection type based on peer connections
  const updateOverallConnectionType = () => {
    const peersList = Array.from(peerConnections.current.keys());
    if (peersList.length === 0) {
      setConnectionType("websocket");
      return;
    }

    const hasConnectedWebRTC = Array.from(dataChannels.current.values()).some(
      (dc) => (dc as RTCDataChannel).readyState === "open"
    );

    if (hasConnectedWebRTC) {
      setConnectionType("webrtc");
    } else {
      setConnectionType("websocket");
    }
  };

  // Encrypt and Sync existing local chat history to a newly joined user
  const syncHistoryToPeer = async (targetUserId: string, socket: WebSocket) => {
    if (!cryptoKey) return;
    try {
      // Package currently existing messages
      const historyPlaintext = JSON.stringify(
        messages.filter((msg) => msg.senderId !== "system")
      );
      const encrypted = await encryptText(historyPlaintext, cryptoKey);

      const packet = {
        type: "sync-history",
        senderName: userName,
        payload: encrypted,
      };

      // Try sending via WebRTC first, fallback to WS relay
      const dc = dataChannels.current.get(targetUserId);
      if (dc && dc.readyState === "open") {
        dc.send(JSON.stringify(packet));
      } else if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "relay",
            roomId: room?.id,
            userId: localUserId,
            userName,
            targetUserId,
            payload: encrypted, // Note: server relays the encrypted payload
          })
        );
      }
    } catch (err) {
      console.error("Failed to sync history to peer:", err);
    }
  };

  const handleReceivedSyncHistory = async (payload: EncryptedPayload) => {
    if (!cryptoKey) return;
    try {
      const plaintext = await decryptText(payload, cryptoKey);
      const syncedMessages: ChatMessage[] = JSON.parse(plaintext);
      
      setMessages((prev) => {
        // Merge histories and filter duplicates
        const existingIds = new Set(prev.map((m) => m.id));
        const merged = [...prev];
        syncedMessages.forEach((msg) => {
          if (!existingIds.has(msg.id)) {
            merged.push(msg);
          }
        });
        return merged.sort((a, b) => a.timestamp - b.timestamp);
      });
    } catch (err) {
      console.error("Failed to decrypt synced history. Double check keys.", err);
    }
  };

  // Decrypt and process an incoming message payload
  const handleReceivedEncryptedMessage = async (
    senderId: string,
    senderName: string,
    payload: EncryptedPayload
  ) => {
    if (!cryptoKey) return;
    try {
      // 1. Decrypt raw text metadata envelope
      const decryptedString = await decryptText(payload, cryptoKey);
      const envelope = JSON.parse(decryptedString);

      const { id, type, text, fileName, fileSize, fileType, mediaPayload, timestamp } = envelope;

      let decryptedUrl = "";

      // 2. If it is a media message (photo, video, audio), decrypt the file payload
      if (mediaPayload && (type === "image" || type === "video" || type === "audio")) {
        const decryptedBlobObj = await decryptBlob(mediaPayload, cryptoKey, fileType);
        decryptedUrl = URL.createObjectURL(decryptedBlobObj);
      }

      const receivedMsg: ChatMessage = {
        id,
        senderId,
        senderName,
        type,
        text,
        mediaUrl: decryptedUrl || undefined,
        fileName,
        fileSize,
        timestamp: timestamp || Date.now(),
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === id)) return prev;
        return [...prev, receivedMsg];
      });
    } catch (err) {
      console.error("Failed to decrypt incoming message payload.", err);
    }
  };

  // Encrypt and send a chat message (Text or File)
  const sendSecureMessage = async (
    type: MessageType,
    textValue?: string,
    fileBlob?: Blob,
    fileName?: string,
    fileSize?: number
  ) => {
    if (!cryptoKey) return;
    setIsEncryptingAndSending(true);

    try {
      const messageId = crypto.randomUUID();
      const timestamp = Date.now();
      
      let localMediaUrl = "";
      let mediaPayload: EncryptedPayload | null = null;

      // 1. If sending file, encrypt the file binary data
      if (fileBlob) {
        localMediaUrl = URL.createObjectURL(fileBlob);
        mediaPayload = await encryptBlob(fileBlob, cryptoKey);
      }

      // 2. Build the message envelope containing metadata
      const envelope = {
        id: messageId,
        type,
        text: textValue,
        fileName,
        fileSize,
        fileType: fileBlob?.type,
        mediaPayload,
        timestamp,
      };

      // 3. Encrypt the entire envelope string with AES-GCM
      const envelopeString = JSON.stringify(envelope);
      const encryptedEnvelope = await encryptText(envelopeString, cryptoKey);

      // 4. Save decrypted version locally so we can display it immediately
      const localMsg: ChatMessage = {
        id: messageId,
        senderId: localUserId,
        senderName: userName,
        type,
        text: textValue,
        mediaUrl: localMediaUrl || undefined,
        fileName,
        fileSize,
        timestamp,
      };
      setMessages((prev) => [...prev, localMsg]);

      // 5. Transmit the encrypted envelope to all active peers
      const packet = {
        type: "encrypted-message",
        senderName: userName,
        payload: encryptedEnvelope,
      };

      // Send to peers over WebRTC if possible, fallback to WebSockets
      let transmittedSuccessfully = false;

      dataChannels.current.forEach((dc) => {
        if (dc.readyState === "open") {
          dc.send(JSON.stringify(packet));
          transmittedSuccessfully = true;
        }
      });

      // If any peer didn't receive via WebRTC, or no WebRTC was open, relay via WebSocket
      if (!transmittedSuccessfully && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "relay",
            roomId: room?.id,
            userId: localUserId,
            userName,
            payload: encryptedEnvelope,
          })
        );
      }

      // Reset file states
      setSelectedFile(null);
      setFilePreviewUrl(null);
    } catch (err) {
      console.error("Failed to encrypt and send message:", err);
    } finally {
      setIsEncryptingAndSending(false);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;

    if (selectedFile) {
      let fileType: MessageType = "text";
      if (selectedFile.type.startsWith("image/")) fileType = "image";
      else if (selectedFile.type.startsWith("video/")) fileType = "video";
      else if (selectedFile.type.startsWith("audio/")) fileType = "audio";

      sendSecureMessage(
        fileType,
        inputText.trim() || undefined,
        selectedFile,
        selectedFile.name,
        selectedFile.size
      );
    } else {
      sendSecureMessage("text", inputText.trim());
    }

    setInputText("");
  };

  // File picker handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith("image/")) {
        setFilePreviewUrl(URL.createObjectURL(file));
      } else {
        setFilePreviewUrl(null);
      }
    }
  };

  // Voice recording sent handler
  const handleSendVoiceMsg = (audioBlob: Blob) => {
    sendSecureMessage("audio", undefined, audioBlob, "mensaje_voz.webm", audioBlob.size);
    setIsRecordingVoice(false);
  };

  const handleJoinOrCreateRoom = (roomId: string, roomKey: string, name: string) => {
    setUserName(name);
    setRoom({
      id: roomId,
      key: roomKey,
      joined: true,
    });
  };

  const handleLeaveRoom = () => {
    setRoom(null);
    setMessages([]);
    setPeers([]);
    setConnectionType("none");
    // Clear URL hashes
    window.location.hash = "";
    setShowWelcome(true);
  };

  return (
    <div id="app-root" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-500/30 selection:text-blue-200">
      
      {/* 1. CREATION / JOIN SCREEN */}
      {!room || !room.joined ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          {showWelcome ? (
            <div className="max-w-md w-full text-center space-y-6 p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden animate-fadeIn">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
              
              <div className="w-16 h-16 bg-blue-600/15 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20 mx-auto shadow-inner">
                <Sparkles size={32} />
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans">
                Whisper P2P
              </h1>
              <p className="text-sm text-slate-400 font-sans leading-relaxed">
                Mensajería instantánea cifrada de extremo a extremo (E2EE), sin base de datos ni registros. Envía fotos, videos y notas de voz directamente de navegador a navegador.
              </p>

              <button
                id="btn-get-started"
                onClick={() => setShowWelcome(false)}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                Comenzar ahora
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <RoomCreator
              onCreateRoom={handleJoinOrCreateRoom}
              onJoinRoom={handleJoinOrCreateRoom}
            />
          )}
        </div>
      ) : (
        
        /* 2. LIVE CHAT ROOM PANEL */
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Header */}
          <RoomHeader
            roomId={room.id}
            roomKey={room.key}
            localName={userName}
            peers={peers}
            connectionType={connectionType}
            onLeave={handleLeaveRoom}
          />

          <div className="flex-1 flex overflow-hidden">
            
            {/* Sidebar (Details Panel - Hidden on mobile) */}
            <aside className="hidden lg:flex flex-col w-72 bg-slate-900/50 border-r border-slate-800 p-5 overflow-y-auto">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-sans mb-3">
                  Usuarios Conectados
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    <span className="text-sm font-sans font-medium text-slate-200">
                      {userName} <span className="text-xs text-slate-500 font-normal">(Tú)</span>
                    </span>
                  </div>
                  {peers.length === 0 ? (
                    <div className="text-xs text-slate-500 p-2 italic font-sans">
                      Esperando que otros usuarios se unan...
                    </div>
                  ) : (
                    peers.map((p) => (
                      <div
                        key={p.userId}
                        className="flex items-center justify-between px-3 py-2 bg-slate-900 border border-slate-800/80 rounded-xl"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                          <span className="text-sm font-sans font-medium text-slate-300">
                            {p.userName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {p.webrtcState === "connected" ? "P2P" : "Relevo"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-8 p-4 bg-blue-950/20 border border-blue-900/20 rounded-2xl flex flex-col gap-2.5">
                <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1.5 font-sans">
                  <ShieldAlert size={14} />
                  Privacidad Absoluta
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  No hay base de datos. Los mensajes se guardan únicamente en la memoria RAM de tu navegador. Si recargas la página o sales de la sala, los mensajes desaparecerán para siempre.
                </p>
              </div>
            </aside>

            {/* Chat Area */}
            <main className="flex-1 flex flex-col bg-slate-950 relative">
              {/* Message scroll viewport */}
              <div id="chat-messages-container" className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <Lock size={20} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-slate-200 font-sans">Canal Seguro Establecido</h4>
                      <p className="text-xs text-slate-500 font-sans">
                        Comparte el enlace de invitación con un contacto. El chat se sincronizará automáticamente cuando se conecte.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSystem = msg.senderId === "system";
                    const isMe = msg.senderId === localUserId;

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2 animate-fadeIn">
                          <span className="px-3 py-1 bg-slate-900/80 border border-slate-800 text-[10px] md:text-xs font-sans text-slate-400 rounded-full">
                            {msg.text}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col gap-1 max-w-[85%] md:max-w-[70%] animate-fadeIn ${
                          isMe ? "ml-auto items-end" : "mr-auto items-start"
                        }`}
                      >
                        {/* Sender name */}
                        <span className="text-[10px] text-slate-500 font-sans px-1.5 font-medium">
                          {isMe ? "Tú" : msg.senderName}
                        </span>

                        {/* Content Bubble */}
                        <div
                          className={`p-3 rounded-2xl flex flex-col gap-2 relative shadow-md ${
                            isMe
                              ? "bg-blue-600 text-white rounded-tr-none"
                              : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none"
                          }`}
                        >
                          {/* Media components */}
                          {msg.mediaUrl && (
                            <MediaMessage
                              type={msg.type as any}
                              mediaUrl={msg.mediaUrl}
                              fileName={msg.fileName}
                              fileSize={msg.fileSize}
                            />
                          )}

                          {/* Text content */}
                          {msg.text && (
                            <p className="text-sm whitespace-pre-wrap leading-relaxed break-words font-sans">
                              {msg.text}
                            </p>
                          )}
                        </div>

                        {/* Message timestamp details */}
                        <div className="flex items-center gap-1 px-1.5 text-[9px] text-slate-600 font-mono">
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5" title="Cifrado con AES-GCM">
                            <Lock size={8} />
                            Cifrado
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* File / attachment preview */}
              {selectedFile && (
                <div className="px-4 py-2 border-t border-slate-900 bg-slate-900/30 flex items-center justify-between gap-3 animate-slideUp">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {filePreviewUrl ? (
                      <img
                        src={filePreviewUrl}
                        alt="Previsualización"
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 object-cover rounded-lg border border-slate-800"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-850 flex items-center justify-center border border-slate-800 text-slate-400">
                        <FileText size={18} />
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <p className="text-xs text-slate-300 font-sans truncate max-w-[200px] md:max-w-md">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    id="btn-remove-attachment"
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreviewUrl(null);
                    }}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-slate-900 bg-slate-950 relative">
                
                {isRecordingVoice ? (
                  <VoiceRecorder
                    onSendAudio={handleSendVoiceMsg}
                    onCancel={() => setIsRecordingVoice(false)}
                  />
                ) : (
                  <form onSubmit={handleSendText} className="flex items-center gap-2">
                    
                    {/* Hidden File input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      accept="image/*,video/*,audio/*"
                      className="hidden"
                    />

                    {/* Attachment trigger button */}
                    <button
                      id="btn-trigger-attachment"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-850 border border-slate-800/80 rounded-2xl transition-all active:scale-95"
                      title="Adjuntar Foto, Video o Audio"
                    >
                      <Paperclip size={20} />
                    </button>

                    {/* Microphone trigger button */}
                    <button
                      id="btn-trigger-voice-record"
                      type="button"
                      onClick={() => setIsRecordingVoice(true)}
                      className="p-2.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-850 border border-slate-800/80 rounded-2xl transition-all active:scale-95"
                      title="Grabar mensaje de voz"
                    >
                      <Mic size={20} />
                    </button>

                    {/* Text Field */}
                    <input
                      id="input-chat-text"
                      type="text"
                      placeholder={
                        selectedFile
                          ? "Añadir comentario..."
                          : "Escribe un mensaje cifrado..."
                      }
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      disabled={isEncryptingAndSending}
                      className="flex-1 bg-slate-900 border border-slate-800/80 rounded-2xl px-4 py-2.5 text-slate-200 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/25 transition-all font-sans placeholder-slate-600"
                    />

                    {/* Submit Button */}
                    <button
                      id="btn-send-chat"
                      type="submit"
                      disabled={(!inputText.trim() && !selectedFile) || isEncryptingAndSending}
                      className={`p-2.5 rounded-2xl transition-all shadow-md ${
                        (inputText.trim() || selectedFile) && !isEncryptingAndSending
                          ? "bg-blue-600 text-white hover:bg-blue-500 hover:scale-[1.02] active:scale-95 cursor-pointer"
                          : "bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800"
                      }`}
                    >
                      {isEncryptingAndSending ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </form>
                )}
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
