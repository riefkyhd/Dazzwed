"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import type { EventRow } from "@/lib/event-server";
import { type EventStatus, eventStatus } from "@/lib/event";
import { type Lang } from "@/lib/i18n";
import {
  loadSessionTriple,
  saveSessionTriple,
  clearNativePending,
  wasNativePending,
  markSessionActive,
  clearSessionActive,
  wasUncleanExit,
  computeRollCodeFromGuestId,
  normalizeRollCode,
} from "@/lib/guest/session";
import {
  addShot,
  countShots,
  newShotId,
  requestPersistentStorage,
} from "@/lib/queue/store";
import { useQueue } from "@/lib/queue/useQueue";
import { processImageOffThread } from "@/lib/imaging/worker";
import dynamic from "next/dynamic";
import { NativeDevelopingModal, type NativeProcessingState } from "./NativeDevelopingModal";
import { LandingScreen } from "./LandingScreen";
import { ThankYouScreen } from "./ThankYouScreen";
import { ClosedScreen } from "./ClosedScreen";
import { GuestErrorBoundary } from "./GuestErrorBoundary";
import { initGlobalTelemetry } from "@/lib/telemetry";

// Code-split CameraScreen & WebGL Look Engine out of initial landing page bundle
const CameraScreen = dynamic(
  () => import("./CameraScreen").then((m) => m.CameraScreen),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-mono uppercase tracking-widest text-zinc-400">Loading Camera…</p>
      </div>
    ),
  }
);

interface GuestAppProps {
  event: EventRow;
  initialRestoreCode?: string | null;
}

type Screen = "landing" | "camera" | "thankyou" | "closed";

export function GuestApp({ event, initialRestoreCode }: GuestAppProps) {
  const initialStatus = useMemo(() => eventStatus(event), [event]);
  const [overrideStatus, setOverrideStatus] = useState<EventStatus | null>(null);
  const status = overrideStatus ?? initialStatus;

  const [screen, setScreen] = useState<Screen>(() =>
    initialStatus !== "open" ? "closed" : "landing",
  );
  const [lang, setLang] = useState<Lang>("en");
  const [guestId, setGuestId] = useState<string | null>(null);
  const [rollCode, setRollCode] = useState<string | null>(null);
  const [shotsPerGuest, setShotsPerGuest] = useState(event.shots_per_guest);
  const [shotsLeft, setShotsLeft] = useState(event.shots_per_guest);

  const [welcomeToast, setWelcomeToast] = useState(false);

  // Background IndexedDB upload queue with real-time pending badge
  const { pendingCount, enqueue } = useQueue(guestId);

  // Global window unhandled error & rejection trap
  useEffect(() => {
    const cleanup = initGlobalTelemetry(event.slug, guestId || undefined);
    return cleanup;
  }, [event.slug, guestId]);

  // Warn user if closing tab while photos are still syncing
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingCount > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [pendingCount]);

  // Track active session for unclean exit detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (wasUncleanExit(event.slug)) {
      setWelcomeToast(true);
      setTimeout(() => setWelcomeToast(false), 4500);
    }
    markSessionActive(event.slug);
    return () => {
      clearSessionActive(event.slug);
    };
  }, [event.slug]);

  // Sync / refresh guest data with server
  const initGuest = useCallback(
    async (guestName: string | null, targetGuestId?: string | null) => {
      try {
        const res = await fetch("/api/guests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSlug: event.slug,
            name: guestName,
            guestId: targetGuestId || guestId || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (err.status && err.status !== "open") {
            setOverrideStatus(err.status);
            setScreen("closed");
            return null;
          }
          throw new Error("Failed to initialize guest");
        }

        const data = (await res.json()) as {
          guestId: string;
          name: string | null;
          rollCode: string;
          shotsPerGuest: number;
          shotsUsed: number;
        };

        const activeGuestId = data.guestId;
        const code = data.rollCode || computeRollCodeFromGuestId(activeGuestId);
        setGuestId(activeGuestId);
        setRollCode(code);
        setShotsPerGuest(data.shotsPerGuest);

        // Calculate true remaining shots from both server count and local DB
        const localCount = await countShots(activeGuestId);
        const taken = Math.max(data.shotsUsed, localCount);
        const remaining = Math.max(0, data.shotsPerGuest - taken);
        setShotsLeft(remaining);

        await saveSessionTriple(event.slug, {
          guestId: activeGuestId,
          name: data.name,
          lang,
          rollCode: code,
        });

        return { guestId: activeGuestId, rollCode: code, remaining };
      } catch (e) {
        console.error("Init guest failed:", e);
        return null;
      }
    },
    [event.slug, guestId, lang],
  );

  // Triple-Healed Multi-Session Identity & ?restore= handling on mount
  useEffect(() => {
    if (status !== "open" || typeof window === "undefined") return;

    const resolveSession = async () => {
      // 1. Check if URL has ?restore=CODE
      if (initialRestoreCode) {
        const norm = normalizeRollCode(initialRestoreCode);
        if (norm.length === 6) {
          try {
            const res = await fetch("/api/guests/restore", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventSlug: event.slug, rollCode: norm }),
            });
            if (res.ok) {
              const data = await res.json();
              setGuestId(data.guestId);
              setRollCode(data.rollCode);
              const remaining = Math.max(0, data.shotsPerGuest - data.shotsUsed);
              setShotsLeft(remaining);
              await saveSessionTriple(event.slug, {
                guestId: data.guestId,
                name: data.name,
                lang,
                rollCode: data.rollCode,
              });
              setWelcomeToast(true);
              setTimeout(() => setWelcomeToast(false), 4000);
              if (remaining <= 0) setScreen("thankyou");
              else setScreen("camera");
              return;
            }
          } catch {
            // Restore link failed, fallback to local session
          }
        }
      }

      // 2. Load triple-healed session (Cookie + localStorage + IndexedDB)
      const saved = await loadSessionTriple(event.slug);
      if (saved) {
        setLang(saved.lang);
        setGuestId(saved.guestId);
        setRollCode(saved.rollCode || computeRollCodeFromGuestId(saved.guestId));

        // Sync with server source-of-truth for accurate shot count
        const synced = await initGuest(saved.name, saved.guestId);
        if (synced) {
          if (synced.remaining <= 0) {
            setScreen("thankyou");
          } else {
            // Returning guest skipping landing screen directly to camera
            setScreen("camera");
            setWelcomeToast(true);
            setTimeout(() => setWelcomeToast(false), 3500);
          }
        }
      }
    };

    void resolveSession();
  }, [event.slug, initialRestoreCode, status, initGuest, lang]);

  const handleStartCamera = async (name: string | null) => {
    // Best-effort fullscreen request on user gesture (Android Chrome, ignores on iOS)
    if (typeof document !== "undefined" && document.documentElement?.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    const res = await initGuest(name);
    if (!res) return;

    if (res.remaining <= 0) {
      setScreen("thankyou");
    } else {
      setScreen("camera");
    }
  };

  const handleLanguageChange = (newLang: Lang) => {
    setLang(newLang);
    void loadSessionTriple(event.slug).then((saved) => {
      if (saved) {
        void saveSessionTriple(event.slug, { ...saved, lang: newLang });
      }
    });
  };

  const handleRestoreSuccess = (data: { guestId: string; name: string | null; rollCode: string; shotsLeft: number }) => {
    setGuestId(data.guestId);
    setRollCode(data.rollCode);
    setShotsLeft(data.shotsLeft);
    void saveSessionTriple(event.slug, {
      guestId: data.guestId,
      name: data.name,
      lang,
      rollCode: data.rollCode,
    });
    setWelcomeToast(true);
    setTimeout(() => setWelcomeToast(false), 4000);
    if (data.shotsLeft <= 0) {
      setScreen("thankyou");
    } else {
      setScreen("camera");
    }
  };

  // Native developing modal state
  const [nativeModalVisible, setNativeModalVisible] = useState(false);
  const [nativeProcessingState, setNativeProcessingState] = useState<NativeProcessingState>("developing");
  const [nativeThumbnail, setNativeThumbnail] = useState<string | null>(null);
  const [nativeProgress, setNativeProgress] = useState(0);
  const [nativeError, setNativeError] = useState<string | undefined>();

  // Request persistent storage on mount
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const recordShot = async (
    blob: Blob,
    activeId: string,
    metadata?: {
      originalBlob?: Blob;
      width?: number;
      height?: number;
      source?: "inapp" | "native";
      tier?: "original" | "high" | "standard" | "lite";
      filtered?: boolean;
    }
  ) => {
    const shotId = newShotId();

    // 1. Store immediately into offline-safe IndexedDB BEFORE network request
    await addShot({
      shotId,
      eventSlug: event.slug,
      guestId: activeId,
      blob,
      thumbnailBlob: blob,
      ...metadata,
    });

    // 2. Trigger upload queue worker
    enqueue();

    // 3. Decrement available shot counter
    const nextLeft = Math.max(0, shotsLeft - 1);
    setShotsLeft(nextLeft);

    if (nextLeft <= 0) {
      setTimeout(() => setScreen("thankyou"), 500);
    }
  };

  const handleShotCaptured = async (filteredBlob: Blob, originalBlob?: Blob) => {
    if (!guestId || shotsLeft <= 0) return;
    await recordShot(filteredBlob, guestId, {
      originalBlob,
      source: "inapp",
      tier: "high",
      filtered: true,
    });
  };

  const handleNativePhoto = async (
    file: File,
    explicitName: string | null = null,
    quickThumb?: string
  ) => {
    clearNativePending(event.slug);

    // Instant UI feedback (<150ms): show developing modal immediately
    const thumbUrl = quickThumb || URL.createObjectURL(file);
    setNativeThumbnail(thumbUrl);
    setNativeProcessingState("developing");
    setNativeProgress(10);
    setNativeError(undefined);
    setNativeModalVisible(true);

    let activeId = guestId;
    if (!activeId) {
      const res = await initGuest(explicitName);
      if (!res || res.remaining <= 0) {
        setNativeModalVisible(false);
        setScreen("thankyou");
        return;
      }
      activeId = res.guestId;
    }

    if (shotsLeft <= 0) {
      setNativeModalVisible(false);
      setScreen("thankyou");
      return;
    }

    // Persist raw uncompressed shot to IndexedDB FIRST so if tab reloads or OS camera kills tab, photo is safe
    const tempShotId = newShotId();
    try {
      await addShot({
        shotId: tempShotId,
        eventSlug: event.slug,
        guestId: activeId,
        blob: file,
        thumbnailBlob: file,
        source: "native",
        tier: "original",
      });
    } catch {
      // IndexedDB write error, proceed with memory pipeline
    }

    try {
      setNativeProcessingState("saving");
      setNativeProgress(45);

      // Process image off main thread via Web Worker with EXIF correction (keeping full sensor resolution)
      const processed = await processImageOffThread(file, {
        maxEdge: 8192, // Keep original sensor resolution for native camera
        quality: 0.95,
        applyFilter: true,
        onProgress: (stage) => {
          if (stage === "decoding") setNativeProgress(30);
          if (stage === "filtering") setNativeProgress(60);
          if (stage === "encoding") setNativeProgress(85);
        },
      });

      setNativeProgress(95);

      // Save processed photo to queue with original file attached as clean original
      await recordShot(processed.blob, activeId, {
        originalBlob: file, // clean original uploaded to "originals" in background
        width: processed.width,
        height: processed.height,
        source: "native",
        tier: "original",
        filtered: true,
      });

      setNativeProgress(100);
      setNativeProcessingState("saved");
    } catch (err) {
      console.error("Error processing native photo:", err);
      setNativeProcessingState("error");
      setNativeError(err instanceof Error ? err.message : "Processing failed");
    }
  };

  return (
    <GuestErrorBoundary
      eventSlug={event.slug}
      guestId={guestId || undefined}
      onReset={() => {
        if (shotsLeft <= 0) setScreen("thankyou");
        else setScreen("camera");
      }}
    >
      {/* Returning guest / unclean exit recovery toast */}
      {welcomeToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-950/95 border border-emerald-500/50 rounded-full shadow-2xl flex items-center gap-2 text-emerald-200 text-xs font-mono animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>
            {lang === "id"
              ? `Selamat datang kembali! Sisa ${shotsLeft} jepretan.`
              : `Welcome back! ${shotsLeft} shots remaining.`}
          </span>
        </div>
      )}

      {nativeModalVisible && (
        <NativeDevelopingModal
          state={nativeProcessingState}
          thumbnailUrl={nativeThumbnail}
          progressPercent={nativeProgress}
          isOffline={typeof navigator !== "undefined" && !navigator.onLine}
          errorMessage={nativeError}
          lang={lang}
          onDismiss={() => {
            setNativeModalVisible(false);
            if (nativeThumbnail) URL.revokeObjectURL(nativeThumbnail);
            setNativeThumbnail(null);
          }}
        />
      )}

      {screen === "closed" && (
        <ClosedScreen
          coupleNames={event.couple_names}
          status={status}
          opensAt={event.opens_at}
          lang={lang}
        />
      )}

      {screen === "thankyou" && (
        <ThankYouScreen
          coupleNames={event.couple_names}
          lang={lang}
          pendingCount={pendingCount}
        />
      )}

      {screen === "camera" && (
        <CameraScreen
          eventSlug={event.slug}
          coupleNames={event.couple_names}
          shotsLeft={shotsLeft}
          totalShots={shotsPerGuest}
          pendingCount={pendingCount}
          guestId={guestId}
          rollCode={rollCode}
          lang={lang}
          onShotCaptured={handleShotCaptured}
          onNativePhoto={handleNativePhoto}
          allowedLookIds={
            event.theme && typeof event.theme === "object" && "allowedLooks" in event.theme && Array.isArray((event.theme as Record<string, unknown>).allowedLooks)
              ? ((event.theme as Record<string, unknown>).allowedLooks as string[])
              : undefined
          }
          defaultLookId={
            event.theme && typeof event.theme === "object" && "activeLookId" in event.theme && typeof (event.theme as Record<string, unknown>).activeLookId === "string"
              ? ((event.theme as Record<string, unknown>).activeLookId as string)
              : "cpm-35"
          }
        />
      )}

      {screen === "landing" && (
        <LandingScreen
          coupleNames={event.couple_names}
          shotsPerGuest={shotsPerGuest}
          eventSlug={event.slug}
          lang={lang}
          onLanguageChange={handleLanguageChange}
          onStartCamera={handleStartCamera}
          onNativePhoto={handleNativePhoto}
          onRestoreSuccess={handleRestoreSuccess}
        />
      )}
    </GuestErrorBoundary>
  );
}
