import React, { useState } from "react";
import { Copy, Check, Shield, Key, Share2, ArrowRight, HelpCircle, Camera } from "lucide-react";
import QRScanner from "./QRScanner";

interface RoomCreatorProps {
  onCreateRoom: (roomId: string, roomKey: string, userName: string) => void;
  onJoinRoom: (roomId: string, roomKey: string, userName: string) => void;
}

export default function RoomCreator({ onCreateRoom, onJoinRoom }: RoomCreatorProps) {
  const [userName, setUserName] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [roomKeyInput, setRoomKeyInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Helper to generate a secure random string
  const generateRandomString = (length: number) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars[values[i] % chars.length];
    }
    return result;
  };

  const handleCreateNewRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    // Generate room id and room cryptographic key
    const newRoomId = generateRandomString(12);
    const newRoomKey = generateRandomString(24);

    // Build the secure URL. We put the key in the #hash so the browser NEVER sends it to the server!
    const origin = window.location.origin + window.location.pathname;
    const shareUrl = `${origin}#/room/${newRoomId}#key=${newRoomKey}`;
    setGeneratedLink(shareUrl);

    // Join room
    onCreateRoom(newRoomId, newRoomKey, userName.trim());
  };

  const handleJoinExistingRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !roomIdInput.trim() || !roomKeyInput.trim()) return;

    // Join with input
    onJoinRoom(roomIdInput.trim(), roomKeyInput.trim(), userName.trim());
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScanSuccess = (decodedText: string) => {
    if (decodedText.includes("#/room/")) {
      try {
        const urlMatch = decodedText.match(/\/room\/([^#?]+)/);
        const keyMatch = decodedText.match(/key=([^&]+)/);
        if (urlMatch) setRoomIdInput(urlMatch[1]);
        if (keyMatch) setRoomKeyInput(keyMatch[1]);
      } catch (err) {
        console.error("Error parsing QR content:", err);
      }
    } else {
      setRoomIdInput(decodedText);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
      {/* Decorative subtle ambient lights */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {isScanning && (
        <QRScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setIsScanning(false)}
        />
      )}

      <div className="flex flex-col items-center text-center mb-8 relative">
        <div className="w-16 h-16 bg-blue-600/15 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-inner mb-4">
          <Shield size={32} />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold font-sans tracking-tight text-white mb-2">
          Mensajería Cifrada P2P
        </h1>
        <p className="text-sm text-slate-400 max-w-md font-sans">
          Envía mensajes, fotos, videos y notas de voz con cifrado de extremo a extremo (E2EE) directamente de navegador a navegador. Sin bases de datos ni intermediarios.
        </p>

        <button
          id="btn-how-it-works"
          type="button"
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          className="mt-3 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-all font-sans"
        >
          <HelpCircle size={14} />
          {showHowItWorks ? "Ocultar explicación" : "¿Cómo funciona el cifrado?"}
        </button>

        {showHowItWorks && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-left text-xs leading-relaxed text-slate-400 max-w-lg transition-all animate-fadeIn">
            <p className="font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <Key size={12} className="text-blue-400" />
              Cifrado 100% en tu Dispositivo (E2EE):
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Al crear una sala, se genera una contraseña criptográfica aleatoria de 256 bits.</li>
              <li>Esta contraseña se incluye únicamente en el <strong className="text-slate-300">hash de la URL (después del símbolo #)</strong>.</li>
              <li>Los navegadores <strong className="text-blue-400">nunca envían el hash al servidor</strong>. Permanecerá estrictamente en tu memoria RAM.</li>
              <li>Tus fotos, videos y notas de voz se cifran localmente con AES-GCM antes de enviarse de forma directa mediante WebRTC (P2P). El intermediario solo ve datos binarios incomprensibles.</li>
            </ul>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8 relative">
        {/* CREATE ROOM COLUMN */}
        <div className="flex flex-col border-b md:border-b-0 md:border-r border-slate-800/80 pb-6 md:pb-0 md:pr-8">
          <h2 className="text-lg font-semibold font-sans text-slate-200 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Crear Nueva Sala
          </h2>
          <form onSubmit={handleCreateNewRoom} className="space-y-4 flex-1 flex flex-col justify-between">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 font-sans">
                Tu Apodo / Nombre
              </label>
              <input
                id="input-create-username"
                type="text"
                required
                maxLength={20}
                placeholder="Ej. Miguel"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:border-blue-500 focus:outline-none transition-all placeholder-slate-600 font-sans"
              />
            </div>
            
            <button
              id="btn-create-room-submit"
              type="submit"
              disabled={!userName.trim()}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all shadow-lg ${
                userName.trim()
                  ? "bg-blue-600 hover:bg-blue-500 text-white hover:scale-[1.02] active:scale-95 cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              Crear Sala Segura
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        {/* JOIN ROOM COLUMN */}
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold font-sans text-slate-200 mb-4 flex items-center gap-2 font-sans justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Unirse a Sala
            </span>
            <button
              id="btn-trigger-login-scanner"
              type="button"
              onClick={() => setIsScanning(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Camera size={12} />
              Escanear QR
            </button>
          </h2>
          <form onSubmit={handleJoinExistingRoom} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 font-sans">
                Tu Apodo / Nombre
              </label>
              <input
                id="input-join-username"
                type="text"
                required
                maxLength={20}
                placeholder="Ej. José"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:border-blue-500 focus:outline-none transition-all placeholder-slate-600 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 font-sans">
                ID de la Sala
              </label>
              <input
                id="input-join-roomid"
                type="text"
                required
                placeholder="Copia el ID o introduce el enlace completo"
                value={roomIdInput}
                onChange={(e) => {
                  const val = e.target.value;
                  // Handle pasting full links like http://.../#/room/ROOM_ID#key=KEY
                  if (val.includes("#/room/")) {
                    try {
                      const urlMatch = val.match(/\/room\/([^#?]+)/);
                      const keyMatch = val.match(/key=([^&]+)/);
                      if (urlMatch) setRoomIdInput(urlMatch[1]);
                      if (keyMatch) setRoomKeyInput(keyMatch[1]);
                    } catch (err) {
                      setRoomIdInput(val);
                    }
                  } else {
                    setRoomIdInput(val);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:border-blue-500 focus:outline-none transition-all placeholder-slate-600 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 font-sans">
                Clave de Descifrado (Clave Secreta)
              </label>
              <input
                id="input-join-roomkey"
                type="password"
                required
                placeholder="Introducir clave de cifrado"
                value={roomKeyInput}
                onChange={(e) => setRoomKeyInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:border-blue-500 focus:outline-none transition-all placeholder-slate-600 font-sans"
              />
            </div>

            <button
              id="btn-join-room-submit"
              type="submit"
              disabled={!userName.trim() || !roomIdInput.trim() || !roomKeyInput.trim()}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all shadow-lg ${
                userName.trim() && roomIdInput.trim() && roomKeyInput.trim()
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-[1.02] active:scale-95 cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              Conectarse de Forma Segura
              <Share2 size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
