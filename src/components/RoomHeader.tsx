import { useState } from "react";
import { ShieldCheck, Copy, Check, Users, LogOut, Info, Lock, QrCode } from "lucide-react";
import { Peer } from "../types";
import QRCodeModal from "./QRCodeModal";

interface RoomHeaderProps {
  roomId: string;
  roomKey: string;
  localName: string;
  peers: Peer[];
  connectionType: "none" | "connecting" | "webrtc" | "websocket";
  onLeave: () => void;
}

export default function RoomHeader({
  roomId,
  roomKey,
  localName,
  peers,
  connectionType,
  onLeave,
}: RoomHeaderProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKeyInfo, setShowKeyInfo] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  const getFullShareLink = () => {
    const origin = window.location.origin + window.location.pathname;
    return `${origin}#/room/${roomId}#key=${roomKey}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getFullShareLink());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(roomKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Build the connection status details
  const getConnectionStatusInfo = () => {
    switch (connectionType) {
      case "connecting":
        return {
          label: "Conectando al servidor...",
          color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
          dot: "bg-amber-500 animate-pulse",
        };
      case "webrtc":
        return {
          label: "P2P Directo (WebRTC) Activo",
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          dot: "bg-emerald-500",
        };
      case "websocket":
        return {
          label: "Relevo Seguro (WebSocket) Activo",
          color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          dot: "bg-blue-500",
        };
      default:
        return {
          label: "Desconectado",
          color: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          dot: "bg-rose-500",
        };
    }
  };

  const status = getConnectionStatusInfo();
  const activePeersCount = peers.filter(p => p.connectionState === "connected").length;

  return (
    <header className="w-full bg-slate-900 border-b border-slate-800 px-4 py-3 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {showQRCode && (
        <QRCodeModal
          roomId={roomId}
          roomKey={roomKey}
          onClose={() => setShowQRCode(false)}
        />
      )}

      {/* LEFT PORTION: Room Name & Encryption Status */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center text-blue-400 border border-blue-500/20">
          <ShieldCheck size={22} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100 font-sans">Sala: {roomId}</h2>
            
            {/* Connection badge */}
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
              {status.label}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
              <Lock size={10} className="text-slate-600" />
              Clave de cifrado de extremo a extremo activa
            </span>
            <button
              id="btn-show-key-details"
              type="button"
              onClick={() => setShowKeyInfo(!showKeyInfo)}
              className="text-[10px] text-blue-400 hover:underline cursor-pointer"
            >
              {showKeyInfo ? "Ocultar" : "Mostrar clave"}
            </button>
          </div>
        </div>
      </div>

      {/* MIDDLE DRAWER FOR ENCRYPTION KEY DETAILS */}
      {showKeyInfo && (
        <div className="md:absolute top-16 left-1/2 md:-translate-x-1/2 bg-slate-950 border border-slate-800 rounded-xl p-3 z-30 shadow-2xl max-w-sm flex flex-col gap-2 animate-fadeIn">
          <p className="text-[10px] text-slate-400 leading-normal">
            Esta clave es estrictamente privada y se usa para descifrar tus archivos y mensajes de voz en tu dispositivo. ¡Nadie más puede verla!
          </p>
          <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <code className="text-xs font-mono text-emerald-400 truncate max-w-[200px]">{roomKey}</code>
            <button
              id="btn-copy-secret-key"
              onClick={handleCopyKey}
              className="text-slate-400 hover:text-white transition-colors"
              title="Copiar Clave"
            >
              {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* RIGHT PORTION: Sharing Link, Peer Count, and Log Out */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* Share QR Code Button */}
        <button
          id="btn-show-qr-code"
          onClick={() => setShowQRCode(true)}
          className="h-9 px-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 hover:text-blue-300 rounded-xl text-xs font-medium flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer font-sans"
        >
          <QrCode size={14} />
          <span>Compartir QR</span>
        </button>

        {/* Copy Shareable Link */}
        <button
          id="btn-copy-room-share-link"
          onClick={handleCopyLink}
          className="h-9 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
        >
          {copiedLink ? (
            <>
              <Check size={14} className="text-emerald-400" />
              <span className="text-emerald-400 font-sans">¡Enlace Copiado!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span className="font-sans">Copiar Enlace</span>
            </>
          )}
        </button>

        {/* Peers listing */}
        <div className="h-9 px-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center gap-2 text-xs font-mono text-slate-400">
          <Users size={14} className="text-slate-500" />
          <span>{localName} (Tú)</span>
          {activePeersCount > 0 && (
            <>
              <span className="text-slate-700">|</span>
              <span className="text-blue-400">+{activePeersCount} en línea</span>
            </>
          )}
        </div>

        {/* Leave Room Button */}
        <button
          id="btn-leave-room"
          onClick={onLeave}
          className="h-9 px-3 bg-red-950/30 hover:bg-red-950/50 border border-red-900/30 text-red-400 hover:text-red-300 rounded-xl text-xs font-medium flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          title="Salir de la sala"
        >
          <LogOut size={14} />
          <span className="font-sans">Salir</span>
        </button>
      </div>
    </header>
  );
}
