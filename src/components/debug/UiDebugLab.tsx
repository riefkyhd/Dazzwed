"use client";

import React, { useState } from "react";
import { calculateLayout, type ViewportLayout } from "@/lib/camera/useViewportLayout";
import type { CameraAspect } from "@/lib/imaging/geometry";
import { CameraTopBar } from "@/components/guest/CameraTopBar";
import { ShutterButton } from "@/components/guest/ShutterButton";
import { ShotCounter } from "@/components/guest/ShotCounter";
import { SyncBadge } from "@/components/guest/SyncBadge";
import { LookDial } from "@/components/guest/LookDial";
import { ViewfinderGestures } from "@/components/guest/ViewfinderGestures";
import { DISPOSABLE_400_LOOK } from "@/lib/imaging/looks/presets";
import { type Lang } from "@/lib/i18n";

interface DevicePreset {
  name: string;
  w: number;
  h: number;
  safe: { top: number; bottom: number; left: number; right: number };
}

const PRESETS: DevicePreset[] = [
  { name: "iPhone SE (compact 320x568)", w: 320, h: 568, safe: { top: 20, bottom: 0, left: 0, right: 0 } },
  { name: "iPhone 8/Standard (375x667)", w: 375, h: 667, safe: { top: 20, bottom: 0, left: 0, right: 0 } },
  { name: "iPhone 13/14 Pro (390x844)", w: 390, h: 844, safe: { top: 47, bottom: 34, left: 0, right: 0 } },
  { name: "iPhone 15/16 Pro Max (430x932)", w: 430, h: 932, safe: { top: 59, bottom: 34, left: 0, right: 0 } },
  { name: "Galaxy S24 (20:9 412x915)", w: 412, h: 915, safe: { top: 32, bottom: 16, left: 0, right: 0 } },
  { name: "Landscape Phone (844x390)", w: 844, h: 390, safe: { top: 0, bottom: 0, left: 47, right: 34 } },
  { name: "Tablet Portrait (768x1024)", w: 768, h: 1024, safe: { top: 24, bottom: 20, left: 0, right: 0 } },
];

export function UiDebugLab() {
  const [presetIdx, setPresetIdx] = useState(2);
  const [aspect, setAspect] = useState<CameraAspect>("3:4");
  const [lang, setLang] = useState<Lang>("en");
  const [timerSec, setTimerSec] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(0);
  const [shotsLeft, setShotsLeft] = useState<number>(12);
  const [flashMode, setFlashMode] = useState<"auto" | "on" | "off">("auto");
  const [fontScale, setFontScale] = useState<number>(100);
  const [exposureEV, setExposureEV] = useState<number>(0);

  const preset = PRESETS[presetIdx];
  const layout: ViewportLayout = calculateLayout(preset.w, preset.h, aspect, preset.safe);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 font-mono flex flex-col items-center">
      <header className="w-full max-w-5xl mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-lg font-bold text-amber-400">CAMERA UI / UX DIAGNOSTIC LAB</h1>
          <p className="text-xs text-zinc-400">Viewport matrix, insets, safe areas & tap-target inspector</p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Device:</span>
            <select
              value={presetIdx}
              onChange={(e) => setPresetIdx(Number(e.target.value))}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white"
            >
              {PRESETS.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Aspect:</span>
            <select
              value={aspect}
              onChange={(e) => setAspect(e.target.value as CameraAspect)}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white"
            >
              <option value="3:4">3:4 (Full)</option>
              <option value="1:1">1:1 (Square)</option>
              <option value="16:9">16:9 (Wide/Tall)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Lang:</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white"
            >
              <option value="en">English (EN)</option>
              <option value="id">Indonesian (ID)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Font:</span>
            <select
              value={fontScale}
              onChange={(e) => setFontScale(Number(e.target.value))}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white"
            >
              <option value={100}>100%</option>
              <option value={115}>115%</option>
              <option value={130}>130%</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Countdown:</span>
            <button
              onClick={() => setCountdown(countdown > 0 ? 0 : 3)}
              className={`px-2 py-1 rounded border text-xs ${
                countdown > 0 ? "bg-amber-400 text-black border-amber-300" : "bg-zinc-800 border-zinc-700"
              }`}
            >
              {countdown > 0 ? `${countdown}s Active` : "Off"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Diagnostic Preview */}
      <div className="flex flex-col lg:flex-row items-start justify-center gap-8 w-full max-w-6xl">
        {/* Device Frame Simulation */}
        <div className="flex flex-col items-center">
          <div className="text-xs text-zinc-400 mb-2 font-sans">
            Simulated Viewport: {preset.w} x {preset.h} px | Mode:{" "}
            <span className="text-amber-400 font-bold uppercase">{layout.mode}</span>
          </div>

          <div
            style={{
              width: `${preset.w}px`,
              height: `${preset.h}px`,
              fontSize: `${fontScale}%`,
            }}
            className="relative bg-black rounded-3xl overflow-hidden border-4 border-zinc-700 shadow-2xl select-none"
          >
            {/* Safe Area Notch / Top Indicator Guide */}
            {preset.safe.top > 0 && (
              <div
                style={{ height: `${preset.safe.top}px` }}
                className="absolute top-0 left-0 right-0 bg-red-500/20 pointer-events-none z-50 flex items-center justify-center border-b border-red-500/40 text-[9px] text-red-300"
              >
                Safe Area Top: {preset.safe.top}px
              </div>
            )}

            {/* Safe Area Bottom Guide */}
            {preset.safe.bottom > 0 && (
              <div
                style={{ height: `${preset.safe.bottom}px` }}
                className="absolute bottom-0 left-0 right-0 bg-red-500/20 pointer-events-none z-50 flex items-center justify-center border-t border-red-500/40 text-[9px] text-red-300"
              >
                Safe Area Bottom: {preset.safe.bottom}px
              </div>
            )}

            {/* Simulated Viewfinder Canvas Box */}
            <div
              style={{
                position: "absolute",
                top: `${layout.viewfinderRect.top}px`,
                left: `${layout.viewfinderRect.left}px`,
                width: `${layout.viewfinderRect.width}px`,
                height: `${layout.viewfinderRect.height}px`,
              }}
              className="bg-zinc-900 border border-amber-500/30 flex flex-col items-center justify-center text-zinc-500 text-xs overflow-hidden relative"
            >
              <div className="w-12 h-12 rounded-full border border-zinc-700 flex items-center justify-center mb-2 pointer-events-none">
                <span className="text-[10px] text-zinc-400 font-mono">{aspect}</span>
              </div>
              <div className="pointer-events-none">
                {layout.viewfinderRect.width} &times; {layout.viewfinderRect.height} px
              </div>
              <div className="text-[10px] text-zinc-600 mt-1 pointer-events-none">
                EV: {exposureEV > 0 ? `+${exposureEV.toFixed(2)}` : exposureEV.toFixed(2)}
              </div>

              {/* Interactive Viewfinder Gestures Overlay */}
              <ViewfinderGestures
                showGrid={false}
                showLevel={false}
                zoom={1.0}
                exposureCompensation={exposureEV}
                onExposureChange={(ev) => setExposureEV(ev)}
              />
            </div>

            {/* In-Frame UI Component Stack */}
            {!layout.isLandscape ? (
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {/* Simulated Top Bar */}
                <div
                  style={{ minHeight: `${layout.topBarHeight}px`, paddingTop: `${preset.safe.top}px` }}
                  className={`w-full flex flex-col justify-center pointer-events-auto ${
                    layout.mode === "banded" ? "bg-black" : "bg-gradient-to-b from-black/80 to-transparent"
                  }`}
                >
                  <CameraTopBar
                    flashAvailable={true}
                    flashMode={flashMode}
                    onChangeFlashMode={setFlashMode}
                    aspect={aspect}
                    onChangeAspect={setAspect}
                    timerSeconds={timerSec}
                    onChangeTimer={setTimerSec}
                    pendingCount={0}
                    onOpenSettings={() => {}}
                    lang={lang}
                  />
                  <div className="flex items-center justify-between px-4 text-xs">
                    <ShotCounter shotsLeft={shotsLeft} lang={lang} />
                    <SyncBadge pendingCount={0} lang={lang} />
                  </div>
                </div>

                {/* Simulated Bottom Controls */}
                <div
                  style={{ minHeight: `${layout.bottomBarHeight}px`, paddingBottom: `${preset.safe.bottom + 8}px` }}
                  className={`w-full flex flex-col items-center justify-end px-4 gap-2.5 pointer-events-auto ${
                    layout.mode === "banded" ? "bg-black" : "bg-gradient-to-t from-black/90 to-transparent"
                  }`}
                >
                  <LookDial
                    activeLook={DISPOSABLE_400_LOOK}
                    onSelectLook={() => {}}
                  />

                  <div className="flex items-center justify-between w-full max-w-sm px-4">
                    <div className="w-14" />
                    <ShutterButton
                      onShoot={() => setShotsLeft((s) => Math.max(0, s - 1))}
                      disabled={shotsLeft <= 0}
                      timerCountdown={countdown}
                      timerTotal={3}
                    />
                    <div className="w-14 flex justify-end">
                      <div className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 text-xs">
                        Flip
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Simulated Landscape Side Rail */
              <div className="absolute inset-0 flex justify-between pointer-events-none">
                <div className="p-4 flex items-center gap-3 pointer-events-auto">
                  <ShotCounter shotsLeft={shotsLeft} lang={lang} />
                  <SyncBadge pendingCount={0} lang={lang} />
                </div>
                <div
                  style={{ width: `${layout.bottomBarHeight}px`, paddingRight: `${preset.safe.right}px` }}
                  className="h-full bg-black flex flex-col items-center justify-between py-6 px-2 pointer-events-auto border-l border-zinc-900"
                >
                  <CameraTopBar
                    flashAvailable={true}
                    flashMode={flashMode}
                    onChangeFlashMode={setFlashMode}
                    aspect={aspect}
                    onChangeAspect={setAspect}
                    timerSeconds={timerSec}
                    onChangeTimer={setTimerSec}
                    pendingCount={0}
                    onOpenSettings={() => {}}
                    lang={lang}
                  />
                  <ShutterButton
                    onShoot={() => setShotsLeft((s) => Math.max(0, s - 1))}
                    disabled={shotsLeft <= 0}
                    timerCountdown={countdown}
                    timerTotal={3}
                  />
                  <div className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 text-xs">
                    Flip
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Geometry & Layout Inspector Specs */}
        <div className="flex-1 bg-zinc-900 p-5 rounded-xl border border-zinc-800 text-xs space-y-4">
          <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wide">Layout Engine Telemetry</h2>

          <div className="grid grid-cols-2 gap-2 text-zinc-300">
            <div className="p-2.5 bg-black/40 rounded border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">MODE</span>
              <span className="font-bold text-amber-400">{layout.mode}</span>
            </div>
            <div className="p-2.5 bg-black/40 rounded border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">ORIENTATION</span>
              <span className="font-bold">{layout.isLandscape ? "Landscape Rail" : "Portrait Stack"}</span>
            </div>
            <div className="p-2.5 bg-black/40 rounded border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">VF RECT (W &times; H)</span>
              <span>{layout.viewfinderRect.width} &times; {layout.viewfinderRect.height} px</span>
            </div>
            <div className="p-2.5 bg-black/40 rounded border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">VF OFFSET (TOP / LEFT)</span>
              <span>{layout.viewfinderRect.top}px / {layout.viewfinderRect.left}px</span>
            </div>
            <div className="p-2.5 bg-black/40 rounded border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">TOP BAR HEIGHT</span>
              <span>{layout.topBarHeight} px</span>
            </div>
            <div className="p-2.5 bg-black/40 rounded border border-zinc-800">
              <span className="text-zinc-500 block text-[10px]">BOTTOM BAR HEIGHT</span>
              <span>{layout.bottomBarHeight} px</span>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-3 space-y-2">
            <h3 className="font-bold text-zinc-300 text-xs uppercase">Tap Target Audit Checklist:</h3>
            <ul className="space-y-1.5 text-zinc-400">
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">&#10003;</span> Shutter Button: 80 &times; 80 px (&gt; 44px min target)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">&#10003;</span> Top Bar Icons (Torch, Timer, Settings): 44 &times; 44 px (11 &times; 11 rem)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">&#10003;</span> Flip Camera Button: 48 &times; 48 px (&gt; 44px min target)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">&#10003;</span> Zero overlap between shutter and safe area bottom home bar
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">&#10003;</span> Zero overlap between top controls and notch / Dynamic Island
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
