"use client";

import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Sparkles } from "lucide-react";

export default function AtmosphericSound() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.25);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const toggleSound = () => {
    if (isPlaying) {
      if (audioCtxRef.current) {
        audioCtxRef.current.suspend();
      }
      setIsPlaying(false);
    } else {
      if (!audioCtxRef.current) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextClass();
          audioCtxRef.current = ctx;

          // Synthesize pink noise for ambient atmosphere
          const bufferSize = ctx.sampleRate * 2;
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
            b6 = white * 0.115926;
          }

          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;
          whiteNoise.loop = true;

          // Biquad filter for smooth breeze frequencies
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(380, ctx.currentTime);
          filter.Q.setValueAtTime(2.0, ctx.currentTime);
          filterNodeRef.current = filter;

          // Gain
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(volume * 0.35, ctx.currentTime);
          gainNodeRef.current = gain;

          whiteNoise.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);

          whiteNoise.start(0);

          // LFO for breathing wind movement
          const lfo = ctx.createOscillator();
          lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
          const lfoGain = ctx.createGain();
          lfoGain.gain.setValueAtTime(140, ctx.currentTime);
          lfo.connect(lfoGain);
          lfoGain.connect(filter.frequency);
          lfo.start(0);
        } catch (e) {
          console.warn("Audio synthesis error:", e);
          return;
        }
      } else {
        audioCtxRef.current.resume();
      }
      setIsPlaying(true);
    }
  };

  return (
    <button
      onClick={toggleSound}
      className="btn-ghost"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 8,
        border: `1px solid ${isPlaying ? "var(--mint)" : "var(--border)"}`,
        background: isPlaying ? "var(--bg-glass-md)" : "transparent",
        color: isPlaying ? "var(--mint)" : "var(--text-muted)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
      title={isPlaying ? "Mute Atmospheric Soundscape" : "Play Atmospheric Breeze Sound"}
      aria-label="Toggle atmospheric sound"
    >
      {isPlaying ? (
        <>
          <Volume2 size={13} className="spin" style={{ animationDuration: "3s" }} />
          <span style={{ fontSize: 11 }}>Sound: On</span>
        </>
      ) : (
        <>
          <VolumeX size={13} />
          <span style={{ fontSize: 11 }}>Sound: Off</span>
        </>
      )}
    </button>
  );
}

