"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { openStream, RESOLUTION_LADDER_4_3 } from "@/lib/camera/constraints";
import { cropRect } from "@/lib/imaging/geometry";

export function CameraDebugView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>("");
  const [trackCapabilities, setTrackCapabilities] = useState<unknown>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [webglInfo, setWebglInfo] = useState<{ version: string; maxTextureSize: number } | null>(null);
  const [exposureCompInfo, setExposureCompInfo] = useState<{
    supported: boolean;
    min?: number;
    max?: number;
    step?: number;
    current?: number;
  } | null>(null);

  const [isSecure] = useState(() => (typeof window !== "undefined" ? window.isSecureContext : true));
  const [browserCaps, setBrowserCaps] = useState<Record<string, boolean | string | number>>({});
  const [streamMeta, setStreamMeta] = useState<{
    width: number;
    height: number;
    aspectRatio: number;
    ladderStep?: string;
  } | null>(null);
  const [lastCaptureDiag, setLastCaptureDiag] = useState<Record<string, unknown> | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setError("enumerateDevices is not supported in this browser");
        return;
      }
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list);
    } catch (e) {
      setError(`enumerateDevices error: ${String(e)}`);
    }
  }, []);

  const startCamera = async (deviceId?: string) => {
    setError(null);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    try {
      // Use production openStream with 4:3 resolution ladder
      const s = await openStream({ deviceId, facing: "environment" });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }

      const track = s.getVideoTracks()[0];
      if (track) {
        const trackWithCaps = track as MediaStreamTrack & {
          getCapabilities?: () => Record<string, unknown>;
        };
        const caps = typeof trackWithCaps.getCapabilities === "function" ? trackWithCaps.getCapabilities() : null;
        const sets = track.getSettings() as MediaTrackSettings & { exposureCompensation?: number };
        setTrackCapabilities(caps);
        setActiveDeviceId(sets.deviceId || deviceId || "");

        if (caps && "exposureCompensation" in caps) {
          const ec = caps.exposureCompensation as { min?: number; max?: number; step?: number };
          setExposureCompInfo({
            supported: true,
            min: ec.min,
            max: ec.max,
            step: ec.step,
            current: sets.exposureCompensation ?? 0,
          });
        } else {
          setExposureCompInfo({ supported: false });
        }

        // Probe torch and ImageCapture
        const capsRecord = (caps || {}) as Record<string, unknown>;
        const hasTorchCap = Boolean(capsRecord.torch);
        const fillModes = Array.isArray(capsRecord.fillLightMode) ? (capsRecord.fillLightMode as string[]) : [];
        setBrowserCaps((prev) => ({
          ...prev,
          torch: hasTorchCap,
          fillLightModes: fillModes.length > 0 ? fillModes.join(", ") : "none",
          imageCapture: typeof window !== "undefined" && "ImageCapture" in window,
        }));

        try {
          const testCanvas = document.createElement("canvas");
          const gl = (testCanvas.getContext("webgl2") || testCanvas.getContext("webgl")) as WebGLRenderingContext | null;
          if (gl) {
            setWebglInfo({
              version: gl instanceof WebGL2RenderingContext ? "WebGL 2" : "WebGL 1",
              maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            });
          }
        } catch {}
      }

      await refreshDevices();
    } catch (e) {
      setError(`getUserMedia failed: ${String(e)}`);
    }
  };

  const testCapture = () => {
    if (!videoRef.current || !stream) return;
    const v = videoRef.current;
    const w = v.videoWidth;
    const h = v.videoHeight;
    const crop34 = cropRect(w, h, "3:4");
    const crop916 = cropRect(w, h, "16:9");
    const crop11 = cropRect(w, h, "1:1");

    setLastCaptureDiag({
      streamSize: { w, h, ratio: Number((w / h).toFixed(4)) },
      crop3_4: crop34,
      crop9_16: crop916,
      crop1_1: crop11,
      subsetCheck: {
        "9:16 inside 3:4": crop916.sx >= crop34.sx && crop916.sw <= crop34.sw,
        "1:1 inside 3:4": crop11.sy >= crop34.sy && crop11.sh <= crop34.sh,
      },
    });
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const updateMeta = () => {
      if (v.videoWidth && v.videoHeight) {
        const w = v.videoWidth;
        const h = v.videoHeight;
        const ratio = w / h;
        const matchingStep = RESOLUTION_LADDER_4_3.find(
          (r) => (r.w === w && r.h === h) || (r.h === w && r.w === h)
        );
        setStreamMeta({
          width: w,
          height: h,
          aspectRatio: Number(ratio.toFixed(4)),
          ladderStep: matchingStep ? `${matchingStep.w}x${matchingStep.h}` : "custom/driver-adapted",
        });
      }
    };
    v.addEventListener("loadedmetadata", updateMeta);
    v.addEventListener("resize", updateMeta);
    return () => {
      v.removeEventListener("loadedmetadata", updateMeta);
      v.removeEventListener("resize", updateMeta);
    };
  }, [stream]);

  useEffect(() => {
    let active = true;
    requestAnimationFrame(() => {
      if (active) void refreshDevices();
    });

    if (typeof window !== "undefined") {
      setBrowserCaps({
        wakeLock: "wakeLock" in navigator,
        requestVideoFrameCallback: "requestVideoFrameCallback" in HTMLVideoElement.prototype,
        offscreenCanvas: typeof OffscreenCanvas !== "undefined",
        webWorker: typeof Worker !== "undefined",
        screenOrientation: "orientation" in screen,
        visualViewport: typeof window.visualViewport !== "undefined",
        devicePixelRatio: window.devicePixelRatio || 1,
      });
    }

    return () => {
      active = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [refreshDevices, stream]);

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-6 font-mono text-xs max-w-5xl mx-auto space-y-6">
      <div className="border-b border-zinc-800 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-lg font-bold text-white mb-1">Diagnostic Camera Lab</h1>
          <p className="text-zinc-500">4:3 Sensor Base Frame & Crop Rect Visualizer</p>
        </div>
        {streamMeta && (
          <div className="text-right">
            <span className="px-2.5 py-1 rounded-md bg-amber-950/80 border border-amber-600/60 text-amber-300 font-bold">
              {streamMeta.width}x{streamMeta.height} ({streamMeta.aspectRatio >= 1.3 ? "4:3 Sensor" : "Non-4:3"})
            </span>
          </div>
        )}
      </div>

      {error && <div className="p-3 bg-red-950 border border-red-800 text-red-200 rounded">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="aspect-[4/3] bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-800 flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
            
            {/* Visual Crop Overlay Guides */}
            {streamMeta && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* 3:4 Base Frame Guide (Green) */}
                <div className="border border-emerald-400/80 absolute inset-0 flex items-start justify-start p-1.5">
                  <span className="bg-emerald-950/80 text-emerald-300 text-[10px] px-1 rounded">3:4 Base</span>
                </div>
                {/* 9:16 Sub-crop Guide (Amber) */}
                <div
                  style={{
                    width: `${((streamMeta.height * 9) / 16 / streamMeta.width) * 100}%`,
                    height: "100%",
                  }}
                  className="border border-amber-400/90 absolute flex items-center justify-center"
                >
                  <span className="bg-amber-950/80 text-amber-300 text-[10px] px-1 rounded">9:16 Crop</span>
                </div>
                {/* 1:1 Sub-crop Guide (Blue) */}
                <div
                  style={{
                    width: `${(Math.min(streamMeta.width, streamMeta.height) / streamMeta.width) * 100}%`,
                    height: `${(Math.min(streamMeta.width, streamMeta.height) / streamMeta.height) * 100}%`,
                  }}
                  className="border border-cyan-400/90 absolute flex items-end justify-center pb-1"
                >
                  <span className="bg-cyan-950/80 text-cyan-300 text-[10px] px-1 rounded">1:1 Crop</span>
                </div>
              </div>
            )}

            {!stream && (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                Camera Inactive
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void startCamera()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all cursor-pointer"
            >
              Start Camera (4:3 Ladder)
            </button>
            {stream && (
              <>
                <button
                  onClick={testCapture}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all cursor-pointer"
                >
                  Dump Capture & Crop Rect
                </button>
                <button
                  onClick={() => {
                    stream.getTracks().forEach((t) => t.stop());
                    setStream(null);
                    setStreamMeta(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-800 hover:bg-red-700 text-white transition-all cursor-pointer"
                >
                  Stop
                </button>
              </>
            )}
          </div>

          {lastCaptureDiag && (
            <div className="p-3 bg-zinc-900 border border-amber-500/50 rounded-xl space-y-2">
              <h3 className="text-amber-400 font-bold">Capture vs Crop Rect Validation</h3>
              <pre className="text-[11px] text-zinc-300 overflow-x-auto">
                {JSON.stringify(lastCaptureDiag, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="space-y-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800 overflow-y-auto max-h-[600px]">
          <h2 className="text-sm font-bold text-zinc-300">Active Stream & Ladder Diagnostics</h2>
          <pre className="text-[11px] text-zinc-400">
            {JSON.stringify(
              {
                streamMeta,
                isSecure,
                capabilities: browserCaps,
                webgl: webglInfo,
                exposureComp: exposureCompInfo,
                activeDeviceId,
              },
              null,
              2
            )}
          </pre>

          <h2 className="text-sm font-bold text-zinc-300 pt-2 border-t border-zinc-800">Track Capabilities</h2>
          <pre className="text-[11px] text-zinc-400">
            {JSON.stringify(trackCapabilities, null, 2)}
          </pre>

          <h2 className="text-sm font-bold text-zinc-300 pt-2 border-t border-zinc-800">Discovered Media Devices ({devices.length})</h2>
          <pre className="text-[11px] text-zinc-400">
            {JSON.stringify(devices.map((d) => ({ kind: d.kind, label: d.label, id: d.deviceId })), null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
