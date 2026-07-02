import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Copy, Check, QrCode, Shield, Download } from "lucide-react";

interface QRCodeModalProps {
  roomId: string;
  roomKey: string;
  onClose: () => void;
}

export default function QRCodeModal({ roomId, roomKey, onClose }: QRCodeModalProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const getFullShareLink = () => {
    const origin = window.location.origin + window.location.pathname;
    return `${origin}#/room/${roomId}#key=${roomKey}`;
  };

  useEffect(() => {
    const link = getFullShareLink();
    QRCode.toDataURL(link, {
      width: 320,
      margin: 2,
      color: {
        dark: "#ffffff",     // white foreground
        light: "#090d16"    // deep dark background
      }
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error("Error generating QR Code:", err));
  }, [roomId, roomKey]);

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

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl flex flex-col items-center">
        {/* Decorative ambient subtle glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Header */}
        <div className="flex justify-between items-center w-full mb-5">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-200 font-sans">Compartir Invitación QR</h3>
          </div>
          <button
            id="close-qr-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="relative p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center mb-5 group">
          {qrCodeDataUrl ? (
            <img
              src={qrCodeDataUrl}
              alt="Código QR de Invitación"
              className="w-48 h-48 rounded-lg select-none"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="w-full space-y-4">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-2.5 text-left">
            <Shield size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Escanea este código QR desde otro dispositivo móvil usando el botón <strong className="text-slate-300">Escanear QR</strong> de la pantalla inicial para agregar el contacto e ingresar a la misma sala cifrada P2P.
            </p>
          </div>

          <div className="space-y-2">
            {/* Share URL */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider font-sans">Enlace Completo</span>
                <button
                  id="btn-copy-qr-url"
                  onClick={handleCopyLink}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-sans"
                >
                  {copiedLink ? (
                    <>
                      <Check size={10} className="text-emerald-400" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={10} />
                      Copiar Enlace
                    </>
                  )}
                </button>
              </div>
              <div className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800/80">
                <p className="text-xs font-mono text-slate-400 truncate">{getFullShareLink()}</p>
              </div>
            </div>

            {/* Room ID and Cryptographic Key */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider font-sans mb-1">ID de la Sala</span>
                <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800/80 text-center">
                  <p className="text-xs font-mono text-slate-300 font-bold truncate select-all">{roomId}</p>
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider font-sans mb-1">Clave de Descifrado</span>
                <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800/80 text-center flex items-center justify-between">
                  <p className="text-xs font-mono text-slate-400 truncate select-all">{roomKey}</p>
                  <button
                    id="btn-copy-qr-key"
                    onClick={handleCopyKey}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {copiedKey ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
