import React, { useState, useRef, useEffect } from 'react';
import { Play, RotateCcw, Download, Sparkles, Volume2 } from 'lucide-react';

const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(
  /\/api\/?$/,
  ''
);

export default function RecordedVideoPlayer({ recordingUrl, autoPlay = true }) {
  const videoRef = useRef(null);
  const [resolvedSrc, setResolvedSrc] = useState('');
  const [blobFallbackUrl, setBlobFallbackUrl] = useState('');
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);

  const rawFullUrl = recordingUrl?.startsWith('http')
    ? recordingUrl
    : `${BACKEND_ORIGIN}${recordingUrl}`;

  useEffect(() => {
    if (!recordingUrl) return;
    setLoadingVideo(true);
    setTriedFallback(false);

    // Play the original un-compressed high-bitrate stream directly so there is ZERO blurriness!
    setResolvedSrc(rawFullUrl);

    return () => {
      if (blobFallbackUrl) {
        URL.revokeObjectURL(blobFallbackUrl);
      }
    };
  }, [recordingUrl, rawFullUrl]);

  const handleVideoError = async () => {
    if (!triedFallback) {
      setTriedFallback(true);
      try {
        setLoadingVideo(true);
        const response = await fetch(rawFullUrl);
        if (response.ok) {
          const buffer = await response.blob();
          const videoBlob = new Blob([buffer], { type: 'video/webm' });
          const objectUrl = URL.createObjectURL(videoBlob);
          setBlobFallbackUrl(objectUrl);
          setResolvedSrc(objectUrl);
        }
      } catch (err) {
        console.error('Video fallback fetch error:', err);
      } finally {
        setLoadingVideo(false);
      }
    } else {
      setLoadingVideo(false);
    }
  };

  const handleLoadedMetadata = () => {
    setLoadingVideo(false);
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = playbackRate;

    if (v.duration === Infinity || Number.isNaN(v.duration)) {
      v.currentTime = 0.01;
    }

    if (autoPlay) {
      v.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleManualPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleRestart = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play()
      .then(() => setIsPlaying(true))
      .catch(() => {});
  };

  const changeSpeed = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  if (!recordingUrl) {
    return (
      <div className="aspect-video rounded-2xl bg-obsidian-950 border border-white/10 flex items-center justify-center text-xs text-slate-400 p-6 text-center">
        No recorded video file uploaded for this session yet.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl group">
        {loadingVideo && (
          <div className="absolute inset-0 z-10 bg-obsidian-950/80 flex flex-col items-center justify-center gap-2 text-xs text-violet-300">
            <Sparkles className="w-7 h-7 animate-spin text-violet-400" />
            <span>Loading Ultra-Clear 1080p/720p HD Recording...</span>
          </div>
        )}

        <video
          ref={videoRef}
          key={resolvedSrc}
          src={resolvedSrc}
          controls
          playsInline
          preload="auto"
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={() => setLoadingVideo(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={handleVideoError}
          className="w-full h-full object-contain bg-black"
        />

        {!loadingVideo && !isPlaying && (
          <button
            type="button"
            onClick={handleManualPlay}
            className="absolute inset-0 bg-black/30 hover:bg-black/20 flex items-center justify-center transition"
            title="Play Recorded Interview Video"
          >
            <div className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-2xl shadow-rose-600/50 scale-100 hover:scale-105 transition">
              <Play size={28} className="ml-1" />
            </div>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualPlay}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5"
          >
            <Play size={13} /> {isPlaying ? 'Pause' : 'Play Video'}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-semibold flex items-center gap-1.5"
          >
            <RotateCcw size={13} /> Replay from Start
          </button>

          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400 ml-1">
            <Volume2 size={13} /> Ultra-HD Video + Voice
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            {[1, 1.25, 1.5, 2].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => changeSpeed(rate)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                  playbackRate === rate
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <a
            href={rawFullUrl}
            download={`interview_recording.webm`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 font-semibold flex items-center gap-1"
          >
            <Download size={13} /> Download HD
          </a>
        </div>
      </div>
    </div>
  );
}
