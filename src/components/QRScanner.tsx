import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, AlertCircle } from "lucide-react";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const elementId = "qr-reader-container-id";

  useEffect(() => {
    // Initialize html5-qrcode scanner
    const startScanner = async () => {
      try {
        setErrorMsg(null);
        setIsInitializing(true);

        const html5QrCode = new Html5Qrcode(elementId);
        qrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            // Success callback
            onScanSuccess(decodedText);
            // Stop scanning and close
            if (html5QrCode.isScanning) {
              html5QrCode.stop().then(() => {
                onClose();
              }).catch(() => {
                onClose();
              });
            } else {
              onClose();
            }
          },
          () => {
            // Quietly ignore scanning errors (normal since it constantly polls video frames)
          }
        );
        setIsInitializing(false);
      } catch (err: any) {
        console.error("QR Code scanner start failure:", err);
        setErrorMsg(
          "No se pudo acceder a la cámara. Asegúrate de dar permisos de cámara a la aplicación."
        );
        setIsInitializing(false);
      }
    };

    // Small delay to ensure container element is mounted in DOM
    const timer = setTimeout(() => {
      startScanner();
    }, 200);

    return () => {
      clearTimeout(timer);
      if (qrCodeRef.current && qrCodeRef.current.isScanning) {
        qrCodeRef.current.stop().catch((e) => console.error("Error stopping QR Scanner on unmount", e));
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl flex flex-col items-center">
        
        {/* Header bar */}
        <div className="flex justify-between items-center w-full mb-4">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-200 font-sans">Escanear Invitación QR</h3>
          </div>
          <button
            id="close-qr-scanner-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera container viewport */}
        <div className="relative w-full aspect-square max-w-[280px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center mb-4">
          
          <div id={elementId} className="w-full h-full object-cover" />

          {isInitializing && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2.5">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-[11px] text-slate-400 font-sans">Iniciando cámara...</p>
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-4 gap-2">
              <AlertCircle size={24} className="text-rose-500" />
              <p className="text-xs text-rose-400 font-sans font-medium">{errorMsg}</p>
              <button
                id="btn-retry-qr-camera"
                onClick={onClose}
                className="mt-2 px-4 py-1.5 bg-slate-800 text-slate-200 text-xs rounded-lg hover:bg-slate-700 transition-colors"
              >
                Volver
              </button>
            </div>
          )}

          {/* Holographic glowing scan line animation */}
          {!isInitializing && !errorMsg && (
            <>
              <div className="absolute inset-x-4 top-1/2 h-[1.5px] bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse pointer-events-none" />
              <div className="absolute inset-4 border-2 border-blue-500/30 rounded-lg pointer-events-none" />
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 max-w-[240px] leading-relaxed font-sans">
          Apunta con la cámara hacia el código QR de invitación de tu contacto para unirte a la sala cifrada automáticamente.
        </p>
      </div>
    </div>
  );
}
