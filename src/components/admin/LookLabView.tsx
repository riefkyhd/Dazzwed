"use client";

import React, { useState, useEffect, useRef } from "react";
import type { LookRecipe, Matrix3x3 } from "@/lib/imaging/looks/types";
import { BUILTIN_LOOKS, getLookById } from "@/lib/imaging/looks/presets";
import { LookEnginePipeline } from "@/lib/imaging/looks/pipeline";
import { drawEmulsionExtras, drawDateStamp, drawInstantFrame } from "@/lib/imaging/looks/stamp-and-frame";
import { linearSrgbToOklab } from "@/lib/imaging/looks/math";

export function LookLabView() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("disposable-400");
  const [currentRecipe, setCurrentRecipe] = useState<LookRecipe>(() =>
    JSON.parse(JSON.stringify(getLookById("disposable-400")))
  );
  const [activeTab, setActiveTab] = useState<"params" | "ref-fit" | "checklist">("params");
  const [sourceType, setSourceType] = useState<"chart" | "fixture" | "camera">("chart");
  const [debugStage, setDebugStage] = useState<number>(0);
  const [debugOverlay, setDebugOverlay] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(30);
  const [showJson, setShowJson] = useState<boolean>(false);
  const [jsonText, setJsonText] = useState<string>("");
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Reference Fit Tool State
  const [phonePhotoSrc, setPhonePhotoSrc] = useState<string | null>(null);
  const [refPhotoSrc, setRefPhotoSrc] = useState<string | null>(null);
  const [isFitting, setIsFitting] = useState(false);
  const [fitResult, setFitResult] = useState<{
    meanDeltaE: number;
    p95DeltaE: number;
    matrix: Matrix3x3;
    referenceId: string;
    referenceNotes: string;
  } | null>(null);
  const [wipePercent, setWipePercent] = useState<number>(50);

  // Scene Checklist State
  const [checkedScenes, setCheckedScenes] = useState<Record<string, boolean>>({
    "skin-daylight": true,
    "foliage": true,
    "sky": true,
    "white-dress": true,
    "warm-tungsten": true,
    "venue-lights": true,
    "direct-flash": true,
    "backlit-window": true,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fixtureImgRef = useRef<HTMLImageElement | null>(null);
  const pipelineRef = useRef<LookEnginePipeline | null>(null);
  const animRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Preload stress fixture photo
  useEffect(() => {
    const img = new Image();
    img.src = "/stress-monitor-lamp.jpg";
    img.onload = () => {
      fixtureImgRef.current = img;
    };
  }, []);

  // Generate extended calibration chart
  const getTestChart = () => {
    if (chartCanvasRef.current) return chartCanvasRef.current;
    const w = 960;
    const h = 720;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;

    ctx.fillStyle = "#121214";
    ctx.fillRect(0, 0, w, h);

    // 1. Sky / Ceiling Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.25);
    skyGrad.addColorStop(0, "#101e30");
    skyGrad.addColorStop(0.5, "#2a5c90");
    skyGrad.addColorStop(1, "#cce8ff");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.25);

    // 2. Ceiling Lamp Disk
    const lampGrad = ctx.createRadialGradient(w * 0.5, h * 0.12, 5, w * 0.5, h * 0.12, 60);
    lampGrad.addColorStop(0, "#ffffff");
    lampGrad.addColorStop(0.3, "#ffffff");
    lampGrad.addColorStop(0.7, "#fff5dd");
    lampGrad.addColorStop(1, "rgba(255, 230, 180, 0)");
    ctx.fillStyle = lampGrad;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.12, 60, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight points & high-contrast metal clip
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(w * 0.82, h * 0.05, 3, 40);
    ctx.fillRect(w * 0.86, h * 0.08, 4, 4);
    ctx.fillRect(w * 0.89, h * 0.11, 2, 2);

    // 3. Grayscale 11-step ramp
    const rampY = h * 0.25;
    const rampH = h * 0.20;
    const steps = 11;
    const stepW = w / steps;
    for (let i = 0; i < steps; i++) {
      const v = Math.round((i / (steps - 1)) * 255);
      ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
      ctx.fillRect(i * stepW, rampY, stepW, rampH);
    }

    // 4. Skin tone patches
    const skinY = h * 0.45;
    const skinH = h * 0.20;
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

    // 5. Primary saturated patches
    const satY = h * 0.65;
    const satH = h * 0.20;
    const prims = ["#e53e3e", "#dd6b20", "#d69e2e", "#38a169", "#319795", "#3182ce", "#805ad5", "#d53f8c"];
    const primStepW = w / prims.length;
    prims.forEach((color, idx) => {
      ctx.fillStyle = color;
      ctx.fillRect(idx * primStepW, satY, primStepW, satH);
    });

    chartCanvasRef.current = c;
    return c;
  };

  // Start Camera Stream
  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      console.warn("Could not start camera in Look Lab:", e);
      setSourceType("chart");
    }
  };

  useEffect(() => {
    if (sourceType === "camera") {
      void startCamera();
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }
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

    const render = (now: DOMHighResTimeStamp) => {
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

      let source: TexImageSource | null = null;
      let w = 960;
      let h = 720;

      if (sourceType === "chart") {
        source = getTestChart();
      } else if (sourceType === "fixture" && fixtureImgRef.current && fixtureImgRef.current.complete) {
        source = fixtureImgRef.current;
        w = fixtureImgRef.current.naturalWidth || 960;
        h = fixtureImgRef.current.naturalHeight || 720;
      } else if (sourceType === "camera" && videoRef.current && videoRef.current.readyState >= 2) {
        source = videoRef.current;
        w = videoRef.current.videoWidth || 960;
        h = videoRef.current.videoHeight || 720;
      }

      if (source && pipelineRef.current) {
        canvas.width = w;
        canvas.height = h;

        pipelineRef.current.render(source, currentRecipe, {
          width: w,
          height: h,
          isCapture: false,
          time: now,
          seed: 42,
          intensity: currentRecipe.intensity ?? 1.0,
          whiteProtect: currentRecipe.whiteProtect ?? true,
          debugStage,
          debugOverlay,
        });

        // Overlay 2D extras if enabled
        const ctx2d = canvas.getContext("2d");
        if (ctx2d) {
          drawEmulsionExtras(ctx2d, w, h, currentRecipe, 42);
          if (currentRecipe.dateStamp.enabled) {
            drawDateStamp(ctx2d, w, h, currentRecipe, new Date());
          }
          if (currentRecipe.frame.type === "instant") {
            drawInstantFrame(ctx2d, w, h, currentRecipe, "Look Lab Calibration");
          }
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [currentRecipe, sourceType, debugStage, debugOverlay]);

  const updateRecipe = (updater: (recipe: LookRecipe) => void) => {
    setCurrentRecipe((prev) => {
      const copy: LookRecipe = JSON.parse(JSON.stringify(prev));
      updater(copy);
      return copy;
    });
  };

  const handleSelectPreset = (id: string) => {
    setSelectedPresetId(id);
    const p = getLookById(id);
    setCurrentRecipe(JSON.parse(JSON.stringify(p)));
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

  // Run Least-Squares Reference Fit
  const handleRunReferenceFit = async () => {
    if (!phonePhotoSrc || !refPhotoSrc) {
      alert("Please upload both a neutral phone capture and a reference photo.");
      return;
    }
    setIsFitting(true);

    try {
      const loadImg = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });

      const [phoneImg, refImg] = await Promise.all([loadImg(phonePhotoSrc), loadImg(refPhotoSrc)]);

      // Downsample both to 64x64 grid
      const size = 64;
      const cPhone = document.createElement("canvas");
      cPhone.width = cPhone.height = size;
      const ctxP = cPhone.getContext("2d")!;
      ctxP.drawImage(phoneImg, 0, 0, size, size);
      const dataP = ctxP.getImageData(0, 0, size, size).data;

      const cRef = document.createElement("canvas");
      cRef.width = cRef.height = size;
      const ctxR = cRef.getContext("2d")!;
      ctxR.drawImage(refImg, 0, 0, size, size);
      const dataR = ctxR.getImageData(0, 0, size, size).data;

      // Least squares fit 3x3 dye matrix
      let sRR = 0, sRG = 0, sRB = 0, sGG = 0, sGB = 0, sBB = 0;
      let sR_Y0 = 0, sG_Y0 = 0, sB_Y0 = 0;
      let sR_Y1 = 0, sG_Y1 = 0, sB_Y1 = 0;
      let sR_Y2 = 0, sG_Y2 = 0, sB_Y2 = 0;

      const count = size * size;
      for (let i = 0; i < count; i++) {
        const r = dataP[i * 4] / 255;
        const g = dataP[i * 4 + 1] / 255;
        const b = dataP[i * 4 + 2] / 255;

        const tr = dataR[i * 4] / 255;
        const tg = dataR[i * 4 + 1] / 255;
        const tb = dataR[i * 4 + 2] / 255;

        sRR += r * r; sRG += r * g; sRB += r * b;
        sGG += g * g; sGB += g * b; sBB += b * b;

        sR_Y0 += r * tr; sG_Y0 += g * tr; sB_Y0 += b * tr;
        sR_Y1 += r * tg; sG_Y1 += g * tg; sB_Y1 += b * tg;
        sR_Y2 += r * tb; sG_Y2 += g * tb; sB_Y2 += b * tb;
      }

      // Simplified diagonal-weighted least squares
      const m00 = sR_Y0 / Math.max(1e-4, sRR);
      const m11 = sG_Y1 / Math.max(1e-4, sGG);
      const m22 = sB_Y2 / Math.max(1e-4, sBB);

      const fittedMatrix: Matrix3x3 = [
        Math.max(0.8, Math.min(1.2, m00)), 0, 0,
        0, Math.max(0.8, Math.min(1.2, m11)), 0,
        0, 0, Math.max(0.8, Math.min(1.2, m22)),
      ];

      // Calculate OKLab residuals
      const deltaEs: number[] = [];
      for (let i = 0; i < count; i++) {
        const r = dataP[i * 4] / 255;
        const g = dataP[i * 4 + 1] / 255;
        const b = dataP[i * 4 + 2] / 255;

        const tr = dataR[i * 4] / 255;
        const tg = dataR[i * 4 + 1] / 255;
        const tb = dataR[i * 4 + 2] / 255;

        const predR = r * fittedMatrix[0];
        const predG = g * fittedMatrix[4];
        const predB = b * fittedMatrix[8];

        const [L1, a1, b1] = linearSrgbToOklab(predR, predG, predB);
        const [L2, a2, b2] = linearSrgbToOklab(tr, tg, tb);
        deltaEs.push(Math.hypot(L1 - L2, a1 - a2, b1 - b2));
      }

      deltaEs.sort((a, b) => a - b);
      const meanDeltaE = deltaEs.reduce((acc, v) => acc + v, 0) / count;
      const p95DeltaE = deltaEs[Math.floor(count * 0.95)];

      setFitResult({
        meanDeltaE: Math.round(meanDeltaE * 1000) / 1000,
        p95DeltaE: Math.round(p95DeltaE * 1000) / 1000,
        matrix: fittedMatrix,
        referenceId: `${selectedPresetId}-calibrated-ref`,
        referenceNotes: `Fitted from neutral phone capture against reference image. Mean ΔE: ${meanDeltaE.toFixed(3)}, P95: ${p95DeltaE.toFixed(3)}`,
      });
    } catch (e) {
      console.error("Reference fit error:", e);
      alert("Failed to compute reference fit.");
    } finally {
      setIsFitting(false);
    }
  };

  const applyFitToRecipe = () => {
    if (!fitResult) return;
    updateRecipe((r) => {
      r.response.dyeMatrix = fitResult.matrix;
      r.reference = {
        referenceId: fitResult.referenceId,
        referenceNotes: fitResult.referenceNotes,
        oklabMeanError: fitResult.meanDeltaE,
        oklabP95Error: fitResult.p95DeltaE,
        fittingDate: new Date().toISOString().split("T")[0],
      };
    });
    alert("Fitted parameters applied to recipe!");
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">Look Lab v2</h1>
            <span className="text-[10px] sm:text-xs font-mono uppercase bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded-full">
              Camera System Tuner
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Physically modeled camera systems: Lens Model → Film Response → OKLCH Grading → Emulsion Optics.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={copyRecipeJson}
            className="flex-1 sm:flex-initial text-center px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-200 border border-zinc-700 cursor-pointer transition-colors"
          >
            {copySuccess ? "Copied!" : "Export JSON"}
          </button>
          <button
            type="button"
            onClick={() => {
              setJsonText(JSON.stringify(currentRecipe, null, 2));
              setShowJson(true);
            }}
            className="flex-1 sm:flex-initial text-center px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-200 border border-zinc-700 cursor-pointer transition-colors"
          >
            Import JSON
          </button>
        </div>
      </div>

      {/* Main Grid: Viewport + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Canvas & Source Selector (7 cols) */}
        <div className="lg:col-span-7 space-y-3 sm:space-y-4">
          <div className="relative aspect-[4/3] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full object-contain" />
            <video ref={videoRef} playsInline muted autoPlay className="hidden" />

            {/* Live readout badge */}
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px] font-mono text-zinc-300">
              <span className={`w-2 h-2 rounded-full ${fps >= 24 ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`} />
              <span>{fps} FPS</span>
            </div>

            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px] font-mono text-amber-300 font-bold">
              {currentRecipe.name.toUpperCase()} ({currentRecipe.aspectRatio})
            </div>
          </div>

          {/* Preset Selector & Source Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-zinc-900/60 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[11px] font-mono text-zinc-400 shrink-0 mr-0.5">PRESET:</span>
              {BUILTIN_LOOKS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer shrink-0 ${
                    selectedPresetId === preset.id
                      ? "bg-amber-400 text-black font-bold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-1 bg-black/50 p-1 rounded-lg border border-zinc-800 text-xs font-mono shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setSourceType("chart")}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  sourceType === "chart" ? "bg-zinc-800 text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Chart
              </button>
              <button
                type="button"
                onClick={() => setSourceType("fixture")}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  sourceType === "fixture" ? "bg-zinc-800 text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Fixture
              </button>
              <button
                type="button"
                onClick={() => setSourceType("camera")}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  sourceType === "camera" ? "bg-zinc-800 text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Camera
              </button>
            </div>
          </div>

          {/* Diagnostic & Bisection Bar */}
          <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/80 space-y-2 text-xs font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-zinc-400 font-semibold">STAGE BISECTION:</span>
              <select
                value={debugStage}
                onChange={(e) => setDebugStage(parseInt(e.target.value, 10))}
                className="bg-black border border-zinc-700 text-amber-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 w-full sm:w-auto"
              >
                <option value={0}>Full Pipeline (All Stages)</option>
                <option value={1}>1. Lens Model (Barrel, CA, Softness, Detail)</option>
                <option value={2}>2. Film Response (Dye Matrix, Curves, Local Contrast)</option>
                <option value={3}>3. OKLCH Grading & Gamut (24-Node LUT, Skin Guard)</option>
                <option value={4}>4. Emulsion Optics (Bloom, Halation, Vignette)</option>
                <option value={5}>5. Film Grain & Exposure Awareness</option>
              </select>
            </div>

            <div className="flex items-center gap-4 pt-1 border-t border-zinc-800/80">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={debugOverlay}
                  onChange={(e) => setDebugOverlay(e.target.checked)}
                  className="w-3.5 h-3.5 accent-amber-400 rounded"
                />
                <span>Overlay: Magenta = NaN/Inf, Cyan = Out-of-Range</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Controls (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-950 p-4 sm:p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-5 max-h-[520px] lg:max-h-[720px] overflow-y-auto">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab("params")}
              className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-colors ${
                activeTab === "params" ? "bg-amber-400 text-black font-bold" : "text-zinc-400 hover:text-white"
              }`}
            >
              Parameters
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ref-fit")}
              className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-colors ${
                activeTab === "ref-fit" ? "bg-amber-400 text-black font-bold" : "text-zinc-400 hover:text-white"
              }`}
            >
              Reference Fit
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("checklist")}
              className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-colors ${
                activeTab === "checklist" ? "bg-amber-400 text-black font-bold" : "text-zinc-400 hover:text-white"
              }`}
            >
              Scene Checklist
            </button>
          </div>

          {/* TAB 1: PARAMETERS */}
          {activeTab === "params" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                <h2 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  Camera System Stages
                </h2>
                <label className="flex items-center gap-1.5 text-xs font-mono text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentRecipe.whiteProtect ?? true}
                    onChange={(e) => updateRecipe((r) => (r.whiteProtect = e.target.checked))}
                    className="w-3.5 h-3.5 accent-amber-400 rounded"
                  />
                  <span>White Protect</span>
                </label>
              </div>

              {/* Look Intensity */}
              <div className="space-y-1 pb-3 border-b border-zinc-900">
                <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                  <span>Look Intensity</span>
                  <span className="font-bold text-amber-300">{Math.round((currentRecipe.intensity ?? 1.0) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={currentRecipe.intensity ?? 1.0}
                  onChange={(e) => updateRecipe((r) => (r.intensity = parseFloat(e.target.value)))}
                  className="w-full h-2 rounded-lg accent-amber-400 bg-zinc-800 cursor-pointer"
                />
              </div>

              {/* 1. Lens Model */}
              <div className="space-y-2.5 pb-3 border-b border-zinc-900">
                <span className="text-xs font-mono text-zinc-400 font-semibold">1. LENS MODEL</span>
                <div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                    <span>Barrel Distortion (κ1)</span>
                    <span className="font-bold text-amber-300">{currentRecipe.lens.distortion.toFixed(3)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.05"
                    step="0.005"
                    value={currentRecipe.lens.distortion}
                    onChange={(e) => updateRecipe((r) => (r.lens.distortion = parseFloat(e.target.value)))}
                    className="w-full h-2 rounded-lg accent-amber-400 bg-zinc-800 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                    <span>Chromatic Aberration</span>
                    <span className="font-bold text-amber-300">{currentRecipe.lens.chromaticAberration.toFixed(4)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.0015"
                    step="0.0001"
                    value={currentRecipe.lens.chromaticAberration}
                    onChange={(e) => updateRecipe((r) => (r.lens.chromaticAberration = parseFloat(e.target.value)))}
                    className="w-full h-2 rounded-lg accent-amber-400 bg-zinc-800 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                    <span>Edge Softness (r1)</span>
                    <span className="font-bold text-amber-300">{currentRecipe.lens.radialBlur.r1.toFixed(4)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.0040"
                    step="0.0002"
                    value={currentRecipe.lens.radialBlur.r1}
                    onChange={(e) => updateRecipe((r) => (r.lens.radialBlur.r1 = parseFloat(e.target.value)))}
                    className="w-full h-2 rounded-lg accent-amber-400 bg-zinc-800 cursor-pointer"
                  />
                </div>
              </div>

              {/* 2. Response & Curves */}
              <div className="space-y-2.5 pb-3 border-b border-zinc-900">
                <span className="text-xs font-mono text-zinc-400 font-semibold">2. FILM RESPONSE</span>
                <div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                    <span>Exposure EV</span>
                    <span className="font-bold text-amber-300">{currentRecipe.response.exposureEV.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.05"
                    value={currentRecipe.response.exposureEV}
                    onChange={(e) => updateRecipe((r) => (r.response.exposureEV = parseFloat(e.target.value)))}
                    className="w-full h-2 rounded-lg accent-amber-400 bg-zinc-800 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                    <span>Local Contrast</span>
                    <span className="font-bold text-amber-300">{currentRecipe.response.localContrast.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-0.3"
                    max="0.3"
                    step="0.05"
                    value={currentRecipe.response.localContrast}
                    onChange={(e) => updateRecipe((r) => (r.response.localContrast = parseFloat(e.target.value)))}
                    className="w-full h-2 rounded-lg accent-amber-400 bg-zinc-800 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                    <span>Effective Lines (Detail)</span>
                    <span className="font-bold text-amber-300">{currentRecipe.response.effectiveLines}</span>
                  </div>
                  <input
                    type="range"
                    min="800"
                    max="3000"
                    step="100"
                    value={currentRecipe.response.effectiveLines}
                    onChange={(e) => updateRecipe((r) => (r.response.effectiveLines = parseInt(e.target.value, 10)))}
                    className="w-full h-2 rounded-lg accent-amber-400 bg-zinc-800 cursor-pointer"
                  />
                </div>
              </div>

              {/* 3. OKLCH & Skin Guard */}
              <div className="space-y-2.5 pb-3 border-b border-zinc-900">
                <span className="text-xs font-mono text-zinc-400 font-semibold">3. OKLCH COLOR GRADING</span>
                <div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                    <span>Saturation</span>
                    <span className="font-bold text-amber-300">{currentRecipe.color.saturation.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={currentRecipe.color.saturation}
                    onChange={(e) => updateRecipe((r) => (r.color.saturation = parseFloat(e.target.value)))}
                    className="w-full h-2 rounded-lg accent-amber-400 bg-zinc-800 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                    <span>Highlight Warmth Drift</span>
                    <span className="font-bold text-amber-300">{currentRecipe.color.highlightWarmth.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.4"
                    step="0.02"
                    value={currentRecipe.color.highlightWarmth}
                    onChange={(e) => updateRecipe((r) => (r.color.highlightWarmth = parseFloat(e.target.value)))}
                    className="w-full h-2 rounded-lg accent-amber-400 bg-zinc-800 cursor-pointer"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentRecipe.color.skinProtection.enabled}
                    onChange={(e) => updateRecipe((r) => (r.color.skinProtection.enabled = e.target.checked))}
                    className="w-3.5 h-3.5 accent-amber-400 rounded"
                  />
                  <span>Skin Tone Protection (20°–55°)</span>
                </label>
              </div>

              {/* 4. Emulsion Artifacts */}
              <div className="space-y-2.5">
                <span className="text-xs font-mono text-zinc-400 font-semibold">4. EMULSION OPTICS & GRAIN</span>
                <div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                    <span>Film Grain</span>
                    <span className="font-bold text-amber-300">{currentRecipe.emulsion.grain.amount.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.3"
                    step="0.02"
                    value={currentRecipe.emulsion.grain.amount}
                    onChange={(e) => updateRecipe((r) => (r.emulsion.grain.amount = parseFloat(e.target.value)))}
                    className="w-full h-2 rounded-lg accent-amber-400 bg-zinc-800 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REFERENCE FIT */}
          {activeTab === "ref-fit" && (
            <div className="space-y-4">
              <div className="border-b border-zinc-900 pb-2">
                <h2 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  Reference Pair Fitter
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Import a neutral phone photo and a real camera/film reference of the same scene. Least squares will fit the dye matrix and report OKLab residuals.
                </p>
              </div>

              {/* Dual Image Uploaders */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-zinc-400">1. Neutral Phone Shot</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setPhonePhotoSrc(URL.createObjectURL(file));
                    }}
                    className="w-full text-[10px] text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:bg-zinc-800 file:text-white cursor-pointer"
                  />
                  {phonePhotoSrc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={phonePhotoSrc} alt="Phone neutral" className="w-full h-24 object-cover rounded-lg border border-zinc-800 mt-1" />
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-zinc-400">2. Reference Camera Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setRefPhotoSrc(URL.createObjectURL(file));
                    }}
                    className="w-full text-[10px] text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:bg-zinc-800 file:text-white cursor-pointer"
                  />
                  {refPhotoSrc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={refPhotoSrc} alt="Reference photo" className="w-full h-24 object-cover rounded-lg border border-zinc-800 mt-1" />
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleRunReferenceFit()}
                disabled={isFitting || !phonePhotoSrc || !refPhotoSrc}
                className="w-full py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-mono font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                {isFitting ? "Aligning & Fitting Matrix..." : "Calculate Least Squares Fit"}
              </button>

              {/* Fit Results */}
              {fitResult && (
                <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center text-zinc-300">
                    <span>Mean OKLab Residual:</span>
                    <span className={`font-bold ${fitResult.meanDeltaE <= 0.05 ? "text-emerald-400" : "text-amber-400"}`}>
                      ΔE {fitResult.meanDeltaE} (Target &lt; 0.05)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-300">
                    <span>95th Percentile:</span>
                    <span className="font-bold text-amber-300">ΔE {fitResult.p95DeltaE}</span>
                  </div>
                  <div className="pt-2 border-t border-zinc-800">
                    <span className="text-zinc-500 text-[10px]">Reference ID:</span>
                    <p className="text-zinc-200 text-xs font-bold">{fitResult.referenceId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={applyFitToRecipe}
                    className="w-full mt-2 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg cursor-pointer"
                  >
                    Apply Fit to Current Recipe
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SCENE CHECKLIST */}
          {activeTab === "checklist" && (
            <div className="space-y-4">
              <div className="border-b border-zinc-900 pb-2">
                <h2 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  Reference Scene Validation Checklist
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Every shipped look must be verified across these 8 core scenes to guarantee skin protection and white neutrality.
                </p>
              </div>

              <div className="space-y-2 text-xs font-mono">
                {[
                  { id: "skin-daylight", title: "1. Skin tones in daylight", desc: "No jaundice/olive hue flips" },
                  { id: "foliage", title: "2. Foliage & greens", desc: "Yellow-teal film response" },
                  { id: "sky", title: "3. Blue sky", desc: "Smooth cyan rolloff without banding" },
                  { id: "white-dress", title: "4. White dress / white shirt", desc: "Clean white within 6% delta" },
                  { id: "warm-tungsten", title: "5. Warm indoor tungsten", desc: "Natural warm ambient glow" },
                  { id: "venue-lights", title: "6. Colored venue lights", desc: "Gamut compression without clipping" },
                  { id: "direct-flash", title: "7. Direct flash portrait", desc: "CCD falloff or film halation" },
                  { id: "backlit-window", title: "8. Backlit window", desc: "No black artifacts in blown highlights" },
                ].map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checkedScenes[item.id] ?? false}
                      onChange={(e) =>
                        setCheckedScenes((prev) => ({ ...prev, [item.id]: e.target.checked }))
                      }
                      className="mt-0.5 w-4 h-4 rounded accent-amber-400"
                    />
                    <div>
                      <span className="text-zinc-200 font-bold block">{item.title}</span>
                      <span className="text-[10px] text-zinc-400">{item.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
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
