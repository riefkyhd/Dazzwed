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
} from "@/lib/queue/store";
import { useQueue } from "@/lib/queue/useQueue";
import { renderFile } from "@/lib/imaging/render";
import { LandingScreen } from "./LandingScreen";
import { CameraScreen } from "./CameraScreen";
import { ThankYouScreen } from "./ThankYouScreen";
import { ClosedScreen } from "./ClosedScreen";

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

  const recordShot = async (blob: Blob, activeId: string) => {
    const shotId = newShotId();

    // 1. Store immediately into offline-safe IndexedDB BEFORE network request
    await addShot({
      shotId,
      eventSlug: event.slug,
      guestId: activeId,
      blob,
    });

    // 2. Trigger upload queue worker
    enqueue();

    // 3. Decrement available shot counter
    const nextLeft = Math.max(0, shotsLeft - 1);
    setShotsLeft(nextLeft);

    if (nextLeft <= 0) {
      setTimeout(() => setScreen("thankyou"), 400);
    }
  };

  const handleShotCaptured = async (blob: Blob) => {
    if (!guestId || shotsLeft <= 0) return;
    await recordShot(blob, guestId);
  };

  const handleNativePhoto = async (file: File, explicitName: string | null = null) => {
    clearNativePending(event.slug);
    let activeId = guestId;

    if (!activeId) {
      const res = await initGuest(explicitName);
      if (!res || res.remaining <= 0) {
        setScreen("thankyou");
        return;
      }
      activeId = res.guestId;
    }

    if (shotsLeft <= 0) {
      setScreen("thankyou");
      return;
    }

    try {
      // Process through the same resize, grain, tint, EXIF strip pipeline
      const blob = await renderFile(file);
      await recordShot(blob, activeId);
    } catch (err) {
      console.error("Error processing native photo:", err);
    }
  };

  if (status !== "open" || screen === "closed") {
    return (
      <ClosedScreen
        coupleNames={event.couple_names}
        status={status}
        opensAt={event.opens_at}
        lang={lang}
      />
    );
  }

  if (screen === "thankyou") {
    return (
      <ThankYouScreen
        coupleNames={event.couple_names}
        lang={lang}
        pendingCount={pendingCount}
      />
    );
  }

  if (screen === "camera") {
    return (
      <CameraScreen
        eventSlug={event.slug}
        coupleNames={event.couple_names}
        shotsLeft={shotsLeft}
        pendingCount={pendingCount}
        lang={lang}
        onShotCaptured={handleShotCaptured}
        onNativePhoto={handleNativePhoto}
      />
    );
  }

  return (
    <LandingScreen
      coupleNames={event.couple_names}
      shotsPerGuest={shotsPerGuest}
      eventSlug={event.slug}
      lang={lang}
      onLanguageChange={handleLanguageChange}
      onStartCamera={handleStartCamera}
      onNativePhoto={handleNativePhoto}
    />
  );
}
