"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import type { EventRow } from "@/lib/event-server";
import { type EventStatus, eventStatus } from "@/lib/event";
import { type Lang } from "@/lib/i18n";
import {
  loadSession,
  saveSession,
  clearNativePending,
  wasNativePending,
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
}

type Screen = "landing" | "camera" | "thankyou" | "closed";

export function GuestApp({ event }: GuestAppProps) {
  const initialStatus = useMemo(() => eventStatus(event), [event]);
  const [overrideStatus, setOverrideStatus] = useState<EventStatus | null>(null);
  const status = overrideStatus ?? initialStatus;

  const [screen, setScreen] = useState<Screen>(() =>
    initialStatus !== "open" ? "closed" : "landing",
  );
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      return loadSession(event.slug)?.lang ?? "en";
    }
    return "en";
  });
  const [guestId, setGuestId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return loadSession(event.slug)?.guestId ?? null;
    }
    return null;
  });
  const [shotsPerGuest, setShotsPerGuest] = useState(event.shots_per_guest);
  const [shotsLeft, setShotsLeft] = useState(event.shots_per_guest);

  // Background IndexedDB upload queue with real-time pending badge
  const { pendingCount, enqueue } = useQueue(guestId);

  // Global window unhandled error & rejection trap
  useEffect(() => {
    const cleanup = initGlobalTelemetry(event.slug, guestId || undefined);
    return cleanup;
  }, [event.slug, guestId]);

  // Restore existing session and counts from IndexedDB asynchronously
  useEffect(() => {
    if (status !== "open") return;

    const saved = loadSession(event.slug);
    if (!saved) return;

    const restoreCounts = async () => {
      const totalTaken = await countShots(saved.guestId);
      const remaining = Math.max(0, event.shots_per_guest - totalTaken);
      setShotsLeft(remaining);

      if (remaining <= 0) {
        setScreen("thankyou");
      } else if (wasNativePending(event.slug)) {
        clearNativePending(event.slug);
        setScreen("camera");
      }
    };

    void restoreCounts();
  }, [event.slug, event.shots_per_guest, status]);

  // Sync / refresh guest data with server
  const initGuest = useCallback(
    async (guestName: string | null) => {
      try {
        const res = await fetch("/api/guests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSlug: event.slug,
            name: guestName,
            guestId: guestId ?? undefined,
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
          shotsPerGuest: number;
          shotsUsed: number;
        };

        const activeGuestId = data.guestId;
        setGuestId(activeGuestId);
        setShotsPerGuest(data.shotsPerGuest);

        // Calculate true remaining shots from both server count and local DB
        const localCount = await countShots(activeGuestId);
        const taken = Math.max(data.shotsUsed, localCount);
        const remaining = Math.max(0, data.shotsPerGuest - taken);
        setShotsLeft(remaining);

        saveSession(event.slug, {
          guestId: activeGuestId,
          name: data.name,
          lang,
        });

        return { guestId: activeGuestId, remaining };
      } catch (e) {
        console.error("Init guest failed:", e);
        return null;
      }
    },
    [event.slug, guestId, lang],
  );

  const handleStartCamera = async (name: string | null) => {
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
    const saved = loadSession(event.slug);
    if (saved) {
      saveSession(event.slug, { ...saved, lang: newLang });
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
          pendingCount={pendingCount}
          lang={lang}
          onShotCaptured={handleShotCaptured}
          onNativePhoto={handleNativePhoto}
          allowedLookIds={
            event.theme && typeof event.theme === "object" && "allowedLooks" in event.theme && Array.isArray((event.theme as Record<string, unknown>).allowedLooks)
              ? ((event.theme as Record<string, unknown>).allowedLooks as string[])
              : undefined
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
        />
      )}
    </GuestErrorBoundary>
  );
}
