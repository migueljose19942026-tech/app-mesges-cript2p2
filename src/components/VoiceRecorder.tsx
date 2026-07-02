import { useState, useEffect, useRef } from "react";
import { Mic, Square, Trash2, Send } from "lucide-react";

interface VoiceRecorderProps {
  onSendAudio: (blob: Blob) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ onSendAudio, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Canvas visualizer refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Start recording automatically on mount
  useEffect(() => {
    startRecording();
    return () => {
      cleanupRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size > 0 && duration > 0) {
          onSendAudio(audioBlob);
        }
      };

      // Start actual recording
      mediaRecorder.start();
      setIsRecording(true);

      // Setup Timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Setup Web Audio API Visualizer
      setupVisualizer(stream);
    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      setPermissionError(
        "No se pudo acceder al micrófono. Por favor, asegúrate de otorgar los permisos."
      );
    }
  };

  const setupVisualizer = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64; // Small fft size for blocky waves

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const draw = () => {
        if (!analyserRef.current || !canvasRef.current) return;
        animationFrameRef.current = requestAnimationFrame(draw);

        analyserRef.current.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          // Normalize height to canvas size
          barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

          // Draw rounded bars centered vertically
          ctx.fillStyle = "#3b82f6"; // Tailwind blue-500
          const y = (canvas.height - barHeight) / 2;
          
          // Draw rounded rectangle
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth - 2, barHeight, 2);
          ctx.fill();

          x += barWidth;
        }
      };

      draw();
    } catch (e) {
      console.error("Failed to start Web Audio visualizer:", e);
    }
  };

  const cleanupRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleStopAndSend = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      cleanupRecording();
      setIsRecording(false);
    }
  };

  const handleDiscard = () => {
    cleanupRecording();
    setIsRecording(false);
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div id="voice-recorder-container" className="flex items-center gap-3 w-full bg-slate-900 border border-slate-800 rounded-full px-4 py-2 transition-all">
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
        <span className="text-sm font-mono text-slate-300 w-12">{formatTime(duration)}</span>
      </div>

      <div className="flex-1 h-10 overflow-hidden">
        {permissionError ? (
          <div className="text-xs text-red-400 truncate py-2">{permissionError}</div>
        ) : (
          <canvas
            ref={canvasRef}
            width={300}
            height={40}
            className="w-full h-full opacity-80"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          id="btn-discard-voice"
          type="button"
          onClick={handleDiscard}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-full transition-all"
          title="Descartar grabación"
        >
          <Trash2 size={18} />
        </button>

        <button
          id="btn-send-voice"
          type="button"
          onClick={handleStopAndSend}
          disabled={duration === 0 || !!permissionError}
          className={`p-2 rounded-full transition-all ${
            duration === 0 || !!permissionError
              ? "text-slate-600 bg-slate-800 cursor-not-allowed"
              : "text-white bg-blue-600 hover:bg-blue-500 hover:scale-105"
          }`}
          title="Enviar mensaje de voz"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
