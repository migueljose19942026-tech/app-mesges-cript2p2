import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Maximize, FileText, Download } from "lucide-react";

interface MediaMessageProps {
  type: "image" | "video" | "audio";
  mediaUrl: string;
  fileName?: string;
  fileSize?: number;
}

export default function MediaMessage({ type, mediaUrl, fileName, fileSize }: MediaMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showLightbox, setShowLightbox] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Clean up Object URL on unmount to prevent browser memory leaks
  useEffect(() => {
    return () => {
      // Note: We don't revoke here because the parent owns the object URL lifecycle
      // and multiple components might reference it, but we cleanup event listeners.
    };
  }, []);

  // Format bytes to a human-readable size
  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  // Format seconds to mm:ss
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle Audio events
  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const toggleAudioPlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.error("Audio playback failed", e));
      setIsPlaying(true);
    }
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleSpeedToggle = () => {
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  if (type === "image") {
    return (
      <div className="relative group overflow-hidden rounded-2xl max-w-sm border border-slate-800 bg-slate-900/50">
        <img
          src={mediaUrl}
          alt={fileName || "Imagen cifrada"}
          referrerPolicy="no-referrer"
          className="w-full h-auto max-h-72 object-cover cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-300"
          onClick={() => setShowLightbox(true)}
        />
        
        {fileName && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-[10px] text-slate-300 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="truncate max-w-[70%]">{fileName}</span>
            <span>{formatSize(fileSize)}</span>
          </div>
        )}

        {/* Lightbox Modal */}
        {showLightbox && (
          <div
            id="lightbox-overlay"
            className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4"
            onClick={() => setShowLightbox(false)}
          >
            <div className="absolute top-4 right-4 flex gap-4">
              <a
                href={mediaUrl}
                download={fileName || "image.png"}
                className="p-2 text-white/80 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-full transition-all"
                title="Descargar imagen"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={20} />
              </a>
              <button
                id="close-lightbox"
                className="p-2 text-white/80 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-full transition-all text-sm font-semibold"
                onClick={() => setShowLightbox(false)}
              >
                ✕
              </button>
            </div>
            <img
              src={mediaUrl}
              alt={fileName || "Imagen cifrada"}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            {fileName && (
              <p className="text-sm text-slate-400 mt-4 font-sans text-center">
                {fileName} <span className="opacity-60">({formatSize(fileSize)})</span>
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="rounded-2xl overflow-hidden max-w-sm border border-slate-800 bg-black shadow-lg">
        <video
          ref={videoRef}
          src={mediaUrl}
          controls
          playsInline
          className="w-full max-h-72 object-contain"
        />
        {fileName && (
          <div className="p-2 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
            <span className="truncate max-w-[70%]">{fileName}</span>
            <span>{formatSize(fileSize)}</span>
          </div>
        )}
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className="w-64 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-col gap-2 shadow-lg">
        <audio
          ref={audioRef}
          src={mediaUrl}
          onTimeUpdate={handleAudioTimeUpdate}
          onLoadedMetadata={handleAudioLoadedMetadata}
          onEnded={handleAudioEnded}
          className="hidden"
        />

        <div className="flex items-center gap-3">
          {/* Custom Play/Pause Button */}
          <button
            id="audio-play-button"
            onClick={toggleAudioPlay}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-md active:scale-95 transition-all"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>

          {/* Slider and progress */}
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="flex items-end gap-1 h-6">
              {/* Fake visual audio bars for premium voice message appearance */}
              {Array.from({ length: 18 }).map((_, i) => {
                // Generate a pseudo-random wave pattern based on index
                const heights = [20, 45, 60, 35, 25, 50, 75, 40, 20, 50, 65, 30, 40, 55, 70, 35, 20, 10];
                const height = heights[i % heights.length];
                // Check if this bar has been played past
                const barProgress = duration ? (currentTime / duration) * 100 : 0;
                const active = (i / 18) * 100 <= barProgress;

                return (
                  <div
                    key={i}
                    className="w-1.5 rounded-full transition-all duration-150"
                    style={{
                      height: `${height}%`,
                      backgroundColor: active ? "#3b82f6" : "#475569",
                    }}
                  />
                );
              })}
            </div>
            
            <input
              id="voice-timeline-slider"
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleTimelineChange}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-1"
            />
          </div>
        </div>

        {/* Audio timing details */}
        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
          <span>{formatTime(currentTime)}</span>
          
          {/* Playback speed selector */}
          <button
            id="audio-speed-btn"
            onClick={handleSpeedToggle}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold active:scale-95 transition-all"
          >
            {playbackSpeed}x
          </button>
          
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-xl max-w-sm">
      <FileText size={24} className="text-slate-400" />
      <div className="flex-1 overflow-hidden">
        <p className="text-xs text-slate-200 truncate">{fileName || "Archivo Cifrado"}</p>
        <p className="text-[10px] text-slate-500 font-mono">{formatSize(fileSize)}</p>
      </div>
      <a
        href={mediaUrl}
        download={fileName || "file"}
        className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-all"
        title="Descargar archivo"
      >
        <Download size={16} />
      </a>
    </div>
  );
}
