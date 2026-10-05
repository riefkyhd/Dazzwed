"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { backLenses, pickerLenses, toLens } from "@/lib/camera/lenses";

export default function CameraDebugPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [supportedConstraints] = useState<Record<string, boolean>>(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getSupportedConstraints) {
      return navigator.mediaDevices.getSupportedConstraints() as Record<string, boolean>;
    }
    return {};
  });
  const [activeDeviceId, setActiveDeviceId] = useState<string>("");
  const [trackCapabilities, setTrackCapabilities] = useState<unknown>(null);
  const [trackSettings, setTrackSettings] = useState<unknown>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomVal, setZoomVal] = useState<number>(1);

  const [ua] = useState(() => (typeof navigator !== "undefined" ? navigator.userAgent : ""));
  const [isSecure] = useState(() => (typeof window !== "undefined" ? window.isSecureContext : true));

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
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      };

      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }

      const track = s.getVideoTracks()[0];
      if (track) {
        setActiveDeviceId(track.getSettings().deviceId || "");
        setTrackSettings(track.getSettings());
        if (track.getCapabilities) {
          const caps = track.getCapabilities();
          setTrackCapabilities(caps);
          // @ts-expect-error zoom may exist on extended capabilities
          if (caps.zoom) setZoomVal(caps.zoom.min || 1);
        }
      }

      // Re-enumerate devices so labels become visible
      await refreshDevices();
    } catch (e) {
      setError(`getUserMedia error: ${String(e)}`);
    }
  };

  useEffect(() => {
    // Subscribe to device changes
    const onDeviceChange = () => {
      void refreshDevices();
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [refreshDevices, stream]);

  const videoInputs = devices.filter((d) => d.kind === "videoinput");
  const detectedBack = backLenses(videoInputs);
  const pickerOptions = pickerLenses(videoInputs);

  const toggleTorch = async () => {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      // @ts-expect-error torch constraint
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (e) {
      setError(`Torch error: ${String(e)}`);
    }
  };

  const applyZoom = async (val: number) => {
    setZoomVal(val);
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      // @ts-expect-error zoom constraint
      await track.applyConstraints({ advanced: [{ zoom: val }] });
    } catch (e) {
      setError(`Zoom error: ${String(e)}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 font-mono text-xs max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <h1 className="text-lg font-bold text-accent">Camera Hardware Debug</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refreshDevices()}
            className="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
          >
            Refresh Devices
          </button>
          <button
            onClick={() => void startCamera(activeDeviceId || undefined)}
            className="px-3 py-1.5 rounded bg-accent text-accent-fg font-bold"
          >
            {stream ? "Restart Camera" : "Open Camera"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/60 border border-red-800 text-red-200 rounded">
          {error}
        </div>
      )}

      {/* Video Viewfinder */}
      <div className="relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
        {!stream && <span className="text-zinc-500">Camera preview idle</span>}
      </div>

      {/* Quick Controls if live */}
      {stream && (
        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 space-y-3">
          <h2 className="text-sm font-bold text-white">Live Track Controls</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void toggleTorch()}
              className={`px-3 py-1.5 rounded font-bold ${
                torchOn ? "bg-amber-400 text-black" : "bg-zinc-800 text-zinc-300"
              }`}
            >
              Torch: {torchOn ? "ON" : "OFF"}
            </button>

            {/* @ts-expect-error zoom inspection */}
            {trackCapabilities?.zoom && (
              <div className="flex items-center gap-2">
                <span>Zoom: {zoomVal.toFixed(1)}x</span>
                <input
                  type="range"
                  // @ts-expect-error zoom min
                  min={trackCapabilities.zoom.min || 1}
                  // @ts-expect-error zoom max
                  max={trackCapabilities.zoom.max || 5}
                  // @ts-expect-error zoom step
                  step={trackCapabilities.zoom.step || 0.1}
                  value={zoomVal}
                  onChange={(e) => void applyZoom(parseFloat(e.target.value))}
                  className="w-32"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Device Environment */}
      <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 space-y-2">
        <h2 className="text-sm font-bold text-white">Environment</h2>
        <p><span className="text-zinc-500">Secure Context:</span> {isSecure ? "true (https)" : "false (camera blocked)"}</p>
        <p className="break-all"><span className="text-zinc-500">User Agent:</span> {ua}</p>
      </div>

      {/* Lens Picker Analysis */}
      <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 space-y-3">
        <h2 className="text-sm font-bold text-white">Lens Heuristics Analysis</h2>
        <p className="text-zinc-400">
          Total video inputs: {videoInputs.length} | Back lenses: {detectedBack.length} | Picker choices: {pickerOptions.length}
        </p>
        <div className="space-y-2">
          {videoInputs.length === 0 ? (
            <p className="text-zinc-500 italic">No video devices listed yet. Click &quot;Open Camera&quot; or &quot;Refresh Devices&quot;.</p>
          ) : (
            videoInputs.map((d) => {
              const lens = toLens(d);
              const isBack = detectedBack.some((b) => b.deviceId === d.deviceId);
              const inPicker = pickerOptions.some((p) => p.deviceId === d.deviceId);
              const isActive = activeDeviceId === d.deviceId;

              return (
                <div
                  key={d.deviceId || d.label}
                  className={`p-2.5 rounded border ${
                    isActive ? "border-accent bg-zinc-950" : "border-zinc-800 bg-zinc-950/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-200">
                      {d.label || "(Label hidden — grant camera permission first)"}
                    </span>
                    <button
                      onClick={() => void startCamera(d.deviceId)}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-[11px]"
                    >
                      Select
                    </button>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 flex flex-wrap gap-2">
                    <span>facing: <b className="text-zinc-300">{lens.facing}</b></span>
                    <span>kind: <b className="text-zinc-300">{lens.kind}</b></span>
                    <span>isBack: <b className="text-zinc-300">{String(isBack)}</b></span>
                    <span>inPicker: <b className="text-zinc-300">{String(inPicker)}</b></span>
                    <span>id: {d.deviceId.slice(0, 12)}…</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Track Capabilities & Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 space-y-2 overflow-x-auto">
          <h2 className="text-sm font-bold text-white">Active track.getCapabilities()</h2>
          <pre className="text-[10px] text-zinc-400">
            {JSON.stringify(trackCapabilities, null, 2) || "None"}
          </pre>
        </div>

        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 space-y-2 overflow-x-auto">
          <h2 className="text-sm font-bold text-white">Active track.getSettings()</h2>
          <pre className="text-[10px] text-zinc-400">
            {JSON.stringify(trackSettings, null, 2) || "None"}
          </pre>
        </div>
      </div>

      {/* Supported Constraints */}
      <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 space-y-2 overflow-x-auto">
        <h2 className="text-sm font-bold text-white">Supported Constraints</h2>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(supportedConstraints).map(([key, supported]) => (
            <span
              key={key}
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                supported ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60" : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {key}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
