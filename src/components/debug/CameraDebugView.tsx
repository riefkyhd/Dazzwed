"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

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
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: "environment" } },
      };

      const s = await navigator.mediaDevices.getUserMedia(constraints);
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

        // Probe torch and ImageCapture fillLightMode
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
    <div className="min-h-screen bg-black text-zinc-100 p-6 font-mono text-xs max-w-4xl mx-auto space-y-6">
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-lg font-bold text-white mb-1">Diagnostic Camera Lab</h1>
        <p className="text-zinc-500">Hardware capability inspector and stream diagnostics (Admin only)</p>
      </div>

      {error && <div className="p-3 bg-red-950 border border-red-800 text-red-200 rounded">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="aspect-[4/3] bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-800">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {!stream && (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                Camera Inactive
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void startCamera()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all"
            >
              Start Camera
            </button>
            {stream && (
              <button
                onClick={() => {
                  stream.getTracks().forEach((t) => t.stop());
                  setStream(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-800 hover:bg-red-700 text-white transition-all"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800 overflow-y-auto max-h-[500px]">
          <h2 className="text-sm font-bold text-zinc-300">Environment & WebGL</h2>
          <pre className="text-[11px] text-zinc-400">
            {JSON.stringify(
              {
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
