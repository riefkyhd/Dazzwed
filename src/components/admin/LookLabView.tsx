"use client";

import React, { useState, useEffect, useRef } from "react";
import type { LookRecipe } from "@/lib/imaging/looks/types";
import { BUILTIN_LOOKS, getLookById } from "@/lib/imaging/looks/presets";
import { LookEnginePipeline } from "@/lib/imaging/looks/pipeline";
import { drawEmulsionExtras, drawDateStamp, drawInstantFrame } from "@/lib/imaging/looks/stamp-and-frame";

export function LookLabView() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("disposable-400");
  const [currentRecipe, setCurrentRecipe] = useState<LookRecipe>(() =>
    JSON.parse(JSON.stringify(getLookById("disposable-400")))
  );
  const [sourceType, setSourceType] = useState<"chart" | "camera">("chart");
  const [fps, setFps] = useState<number>(30);
  const [showJson, setShowJson] = useState<boolean>(false);
  const [jsonText, setJsonText] = useState<string>("");
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipelineRef = useRef<LookEnginePipeline | null>(null);
  const animRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Generate built-in calibration chart (grayscale ramp, saturated patches, skin tones, smooth sky gradient)
  const getTestChart = () => {
    if (chartCanvasRef.current) return chartCanvasRef.current;
    const w = 960;
    const h = 720;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;

    // 1. Smooth Sky Gradient (top 35%)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.35);
    skyGrad.addColorStop(0, "#2c5282");
    skyGrad.addColorStop(0.5, "#4299e1");
    skyGrad.addColorStop(1, "#bee3f8");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.35);

    // 2. Grayscale 11-step ramp (y: 35% to 55%)
    const rampY = h * 0.35;
    const rampH = h * 0.2;
    const steps = 11;
    const stepW = w / steps;
    for (let i = 0; i < steps; i++) {
      const v = Math.round((i / (steps - 1)) * 255);
      ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
      ctx.fillRect(i * stepW, rampY, stepW, rampH);
    }

    // 3. Skin tone patches (y: 55% to 75%)
    const skinY = h * 0.55;
    const skinH = h * 0.2;
    const skinTones = [
      "#fbf0ea",
      "#f4d0b5",
      "#e8b991",
      "#c68642",
      "#8d5524",
      "#513217",
      "#ff6b6b",
      "#4ecdc4",
    ];
    const skinStepW = w / skinTones.length;
    skinTones.forEach((tone, idx) => {
      ctx.fillStyle = tone;
      ctx.fillRect(idx * skinStepW, skinY, skinStepW, skinH);
    });

    // 4. Primary saturated patches (y: 75% to 100%)
    const satY = h * 0.75;
    const satH = h * 0.25;
    const prims = ["#e53e3e", "#dd6b20", "#d69e2e", "#38a169", "#319795", "#3182ce", "#805ad5", "#d53f8c"];
    const primStepW = w / prims.length;
    prims.forEach((color, idx) => {
      ctx.fillStyle = color;
      ctx.fillRect(idx * primStepW, satY, primStepW, satH);
    });

    return (chartCanvasRef.current = c);
  };

  // Switch look preset
  const handleSelectPreset = (id: string) => {
    setSelectedPresetId(id);
    const preset = getLookById(id);
    setCurrentRecipe(JSON.parse(JSON.stringify(preset)));
  };

  // Camera stream handler
  useEffect(() => {
    if (sourceType === "camera") {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch((err) => {
          console.warn("Could not open camera in Look Lab:", err);
          setSourceType("chart");
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [sourceType]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!pipelineRef.current) {
      pipelineRef.current = new LookEnginePipeline(canvas);
    }

    let lastTime = performance.now();
    let frameCount = 0;
    let fpsAccum = 0;

    const render = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      if (delta > 0) {
        fpsAccum += 1000 / delta;
        frameCount++;
        if (frameCount >= 15) {
          setFps(Math.round(fpsAccum / frameCount));
          fpsAccum = 0;
          frameCount = 0;
        }
      }

      let src: TexImageSource | null = null;
      let w = 960;
      let h = 720;

      if (sourceType === "camera" && videoRef.current && videoRef.current.readyState >= 2) {
        src = videoRef.current;
        w = videoRef.current.videoWidth || 960;
        h = videoRef.current.videoHeight || 720;
      } else {
        src = getTestChart();
        w = 960;
        h = 720;
      }

      if (src && pipelineRef.current) {
        pipelineRef.current.render(src, currentRecipe, {
          width: w,
          height: h,
          isCapture: false,
          time: now * 0.001,
        });

        // 2D extras preview
        const ctx2d = canvas.getContext("2d");
        if (ctx2d) {
          drawEmulsionExtras(ctx2d, w, h, currentRecipe, 42);
          if (currentRecipe.dateStamp.enabled) {
            drawDateStamp(ctx2d, w, h, currentRecipe);
          }
          if (currentRecipe.frame.type === "instant") {
            drawInstantFrame(ctx2d, w, h, currentRecipe, "Look Lab Preview");
          }
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [currentRecipe, sourceType]);

  const updateRecipe = (updater: (prev: LookRecipe) => void) => {
    setCurrentRecipe((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      updater(clone);
      return clone;
    });
  };

  const copyRecipeJson = () => {
    navigator.clipboard.writeText(JSON.stringify(currentRecipe, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const importRecipeJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setCurrentRecipe(parsed);
      setShowJson(false);
    } catch {
      alert("Invalid JSON format");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-white tracking-tight">Look Lab</h1>
            <span className="text-xs font-mono uppercase bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded-full">
              Live Shader Tuner
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Fine-tune film curves, grain, halation, and color grading in real time with 0-to-1 normalized spatial parameters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyRecipeJson}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-200 border border-zinc-700 cursor-pointer"
          >
            {copySuccess ? "Copied!" : "Export JSON"}
          </button>
          <button
            type="button"
            onClick={() => {
              setJsonText(JSON.stringify(currentRecipe, null, 2));
              setShowJson(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-200 border border-zinc-700 cursor-pointer"
          >
            Import JSON
          </button>
        </div>
      </div>

      {/* Main Grid: Viewport + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Canvas & Source Selector (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-[4/3] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full object-contain" />
            <video ref={videoRef} playsInline muted autoPlay className="hidden" />

            {/* Live readout badge */}
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px] font-mono text-zinc-300">
              <span className={`w-2 h-2 rounded-full ${fps >= 24 ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`} />
              <span>{fps} FPS</span>
            </div>

            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px] font-mono text-amber-300 font-bold">
              {currentRecipe.name.toUpperCase()}
            </div>
          </div>

          {/* Preset Selector & Source Switcher */}
          <div className="flex items-center justify-between p-3 bg-zinc-900/60 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono text-zinc-400 mr-1">PRESET:</span>
              {BUILTIN_LOOKS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    selectedPresetId === preset.id
                      ? "bg-amber-400 text-black font-bold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-black/50 p-1 rounded-lg border border-zinc-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => setSourceType("chart")}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  sourceType === "chart" ? "bg-zinc-800 text-white font-semibold" : "text-zinc-500"
                }`}
              >
                Chart
              </button>
              <button
                type="button"
                onClick={() => setSourceType("camera")}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  sourceType === "camera" ? "bg-zinc-800 text-white font-semibold" : "text-zinc-500"
                }`}
              >
                Camera
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Param Sliders (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-950 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-5 max-h-[720px] overflow-y-auto">
          <h2 className="text-sm font-mono uppercase tracking-wider text-amber-400 font-semibold pb-2 border-b border-zinc-900">
            Shader Parameters
          </h2>

          {/* 1. Exposure & Contrast */}
          <div className="space-y-3">
            <span className="text-xs font-mono text-zinc-400">EXPOSURE & CURVE</span>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-zinc-300">
                <span>Exposure EV</span>
                <span>{currentRecipe.exposureEV.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-1.5"
                max="1.5"
                step="0.05"
                value={currentRecipe.exposureEV}
                onChange={(e) => updateRecipe((r) => (r.exposureEV = parseFloat(e.target.value)))}
                className="w-full accent-amber-400"
              />

              <div className="flex justify-between text-xs font-mono text-zinc-300">
                <span>Contrast</span>
                <span>{currentRecipe.curve.contrast.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.05"
                value={currentRecipe.curve.contrast}
                onChange={(e) => updateRecipe((r) => (r.curve.contrast = parseFloat(e.target.value)))}
                className="w-full accent-amber-400"
              />

              <div className="flex justify-between text-xs font-mono text-zinc-300">
                <span>Shadow Toe (Lifted Blacks)</span>
                <span>{currentRecipe.curve.toe.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.2"
                step="0.01"
                value={currentRecipe.curve.toe}
                onChange={(e) => updateRecipe((r) => (r.curve.toe = parseFloat(e.target.value)))}
                className="w-full accent-amber-400"
              />

              <div className="flex justify-between text-xs font-mono text-zinc-300">
                <span>Saturation</span>
                <span>{currentRecipe.saturation.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.05"
                value={currentRecipe.saturation}
                onChange={(e) => updateRecipe((r) => (r.saturation = parseFloat(e.target.value)))}
                className="w-full accent-amber-400"
              />
            </div>
          </div>

          {/* 2. Grain */}
          <div className="space-y-3 pt-3 border-t border-zinc-900">
            <span className="text-xs font-mono text-zinc-400">FILM GRAIN</span>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-zinc-300">
                <span>Amount</span>
                <span>{currentRecipe.grain.amount.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.4"
                step="0.01"
                value={currentRecipe.grain.amount}
                onChange={(e) => updateRecipe((r) => (r.grain.amount = parseFloat(e.target.value)))}
                className="w-full accent-amber-400"
              />

              <div className="flex justify-between text-xs font-mono text-zinc-300">
                <span>Chroma Noise</span>
                <span>{currentRecipe.grain.chroma.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={currentRecipe.grain.chroma}
                onChange={(e) => updateRecipe((r) => (r.grain.chroma = parseFloat(e.target.value)))}
                className="w-full accent-amber-400"
              />
            </div>
          </div>

          {/* 3. Vignette & Flash Falloff */}
          <div className="space-y-3 pt-3 border-t border-zinc-900">
            <span className="text-xs font-mono text-zinc-400">OPTICS & VIGNETTE</span>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-zinc-300">
                <span>Vignette Strength</span>
                <span>{currentRecipe.vignette.strength.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.8"
                step="0.05"
                value={currentRecipe.vignette.strength}
                onChange={(e) => updateRecipe((r) => (r.vignette.strength = parseFloat(e.target.value)))}
                className="w-full accent-amber-400"
              />

              <div className="flex justify-between text-xs font-mono text-zinc-300">
                <span>Flash Falloff</span>
                <span>{currentRecipe.flashFalloff.strength.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={currentRecipe.flashFalloff.strength}
                onChange={(e) => updateRecipe((r) => (r.flashFalloff.strength = parseFloat(e.target.value)))}
                className="w-full accent-amber-400"
              />
            </div>
          </div>

          {/* 4. Date Stamp & Frame */}
          <div className="space-y-3 pt-3 border-t border-zinc-900">
            <span className="text-xs font-mono text-zinc-400">POST-PROCESS EXTRAS</span>
            <div className="flex items-center gap-4 text-xs font-mono text-zinc-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentRecipe.dateStamp.enabled}
                  onChange={(e) => updateRecipe((r) => (r.dateStamp.enabled = e.target.checked))}
                  className="rounded accent-amber-400"
                />
                <span>Orange Date Stamp</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentRecipe.frame.type === "instant"}
                  onChange={(e) => updateRecipe((r) => (r.frame.type = e.target.checked ? "instant" : "none"))}
                  className="rounded accent-amber-400"
                />
                <span>Instant Border</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* JSON Import Modal */}
      {showJson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-serif font-bold text-white">Import Recipe JSON</h3>
            <textarea
              rows={12}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs text-zinc-300 focus:outline-none focus:border-amber-400"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowJson(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-xs font-mono text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={importRecipeJson}
                className="px-4 py-2 rounded-xl bg-amber-400 text-xs font-mono text-black font-bold hover:bg-amber-300 cursor-pointer"
              >
                Apply Recipe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
