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
  const [measuredFps, setMeasuredFps] = useState<number>(0);
  const [takePhotoSupported, setTakePhotoSupported] = useState<boolean>(false);
  const [webglInfo, setWebglInfo] = useState<{ version: string; maxTextureSize: number } | null>(null);
  const [testCaptureResult, setTestCaptureResult] = useState<{ sizeKB: number; width: number; height: number } | null>(null);
  const [testingCapture, setTestingCapture] = useState(false);
  const [debugStage, setDebugStage] = useState<number>(0);
  const [debugOverlay, setDebugOverlay] = useState<boolean>(false);

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

        // Check if ImageCapture.takePhoto() is available
        if (typeof window !== "undefined" && "ImageCapture" in window) {
          setTakePhotoSupported(true);
        } else {
          setTakePhotoSupported(false);
        }
      }

      // Check WebGL version & MAX_TEXTURE_SIZE
      const testCanvas = document.createElement("canvas");
      const gl2 = testCanvas.getContext("webgl2");
      if (gl2) {
        setWebglInfo({
          version: "WebGL 2.0",
          maxTextureSize: gl2.getParameter(gl2.MAX_TEXTURE_SIZE) || 4096,
        });
      } else {
        const gl1 = testCanvas.getContext("webgl");
        if (gl1) {
          setWebglInfo({
            version: "WebGL 1.0",
            maxTextureSize: gl1.getParameter(gl1.MAX_TEXTURE_SIZE) || 2048,
          });
        }
      }

      // Re-enumerate devices so labels become visible
      await refreshDevices();
    } catch (e) {
      setError(`getUserMedia error: ${String(e)}`);
    }
  };

  const runTestCapture = async () => {
    if (!videoRef.current || !stream) return;
    setTestingCapture(true);
    try {
      const { renderShot } = await import("@/lib/imaging/render");
      const blob = await renderShot(videoRef.current, { maxEdge: 4096, quality: 0.92, applyFilter: true });
      const bmp = await createImageBitmap(blob);
      setTestCaptureResult({
        sizeKB: Math.round(blob.size / 1024),
        width: bmp.width,
        height: bmp.height,
      });
      bmp.close();
    } catch (e) {
      setError(`Test capture error: ${String(e)}`);
    } finally {
      setTestingCapture(false);
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
          <h2 className="text-sm font-bold text-white">Live Track & Hardware Capabilities</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void toggleTorch()}
              className={`px-3 py-1.5 rounded font-bold ${
                torchOn ? "bg-amber-400 text-black" : "bg-zinc-800 text-zinc-300"
              }`}
            >
              Torch: {torchOn ? "ON" : "OFF"}
            </button>

            {/* Test Capture Button */}
            <button
              onClick={() => void runTestCapture()}
              disabled={testingCapture}
              className="px-3 py-1.5 rounded bg-accent text-accent-fg font-bold disabled:opacity-50 cursor-pointer"
            >
              {testingCapture ? "Processing Shot…" : "Run Test Capture"}
            </button>

            {/* Stage bisect & overlay diagnostics */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-zinc-500">Stage:</span>
              <select
                value={debugStage}
                onChange={(e) => setDebugStage(parseInt(e.target.value, 10))}
                className="bg-black border border-zinc-700 text-amber-300 rounded px-2 py-1 text-xs"
              >
                <option value={0}>All Stages</option>
                <option value={1}>1. Sharpen</option>
                <option value={2}>2. Exposure & Flash</option>
                <option value={3}>3. Filmic Curve</option>
                <option value={4}>4. Lift/Gamma/Gain</option>
                <option value={5}>5. Split Tone & White Protect</option>
                <option value={6}>6. Grain</option>
                <option value={7}>7. Vignette</option>
              </select>

              <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer ml-2">
                <input
                  type="checkbox"
                  checked={debugOverlay}
                  onChange={(e) => setDebugOverlay(e.target.checked)}
                  className="accent-amber-400"
                />
                <span>NaN/Cyan Overlay</span>
              </label>
            </div>

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

          {/* Test Capture Results */}
          {testCaptureResult && (
            <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[11px] font-mono">
              ✓ Test Capture: {testCaptureResult.width}x{testCaptureResult.height} px &bull; {testCaptureResult.sizeKB} KB ({(testCaptureResult.sizeKB / 1024).toFixed(2)} MB)
            </div>
          )}

          {/* Hardware & WebGL Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-zinc-400">
            <div>
              <span className="text-zinc-500 block text-[10px]">IMAGE CAPTURE API</span>
              <span className={takePhotoSupported ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                {takePhotoSupported ? "Supported (takePhoto)" : "Video Frame Fallback"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px]">WEBGL ENGINE</span>
              <span className="text-amber-400 font-bold">
                {webglInfo?.version || "Detecting…"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px]">MAX TEXTURE SIZE</span>
              <span className="text-amber-400 font-bold">
                {webglInfo ? `${webglInfo.maxTextureSize}px` : "Detecting…"}
              </span>
            </div>
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
