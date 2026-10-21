"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { EventRow } from "@/lib/event-server";
import { type EventStatus, eventStatus } from "@/lib/event";
import { type Lang, t } from "@/lib/i18n";
import {
  loadSessionTriple,
  saveSessionTriple,
  clearSessionTriple,
  clearNativePending,
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
import { getLookById, CPM35_LOOK } from "@/lib/imaging/looks/presets";
import dynamic from "next/dynamic";
import { NativeDevelopingModal, type NativeProcessingState } from "./NativeDevelopingModal";
import { LandingScreen, type ConsentSubmission } from "./LandingScreen";
import { ThankYouScreen } from "./ThankYouScreen";
import { ClosedScreen } from "./ClosedScreen";
import { GuestErrorBoundary } from "./GuestErrorBoundary";
import { initGlobalTelemetry } from "@/lib/telemetry";
import { hasValidConsent, getLocalConsent, saveLocalConsent, clearLocalConsent } from "@/lib/guest/consent";
import { CONSENT_VERSION } from "@/constants/consentCopy";

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

export function resolveThemeLooks(theme: unknown): {
  allowedLookIds?: string[];
  defaultLookId: string;
} {
  if (!theme || typeof theme !== "object") {
    return { defaultLookId: "cpm-35" };
  }
  const t = theme as Record<string, unknown>;
  const rawAllowed = t.allowedLookIds ?? t.allowedLooks;
  const allowedLookIds = Array.isArray(rawAllowed)
    ? rawAllowed.filter((x): x is string => typeof x === "string")
    : undefined;

  const rawDefault = t.defaultLookId ?? t.activeLookId;
  let defaultLookId = typeof rawDefault === "string" ? rawDefault : "cpm-35";

  if (allowedLookIds && allowedLookIds.length > 0 && !allowedLookIds.includes(defaultLookId)) {
    defaultLookId = allowedLookIds[0];
  }

  return { allowedLookIds, defaultLookId };
}

export interface InitialGuestState {
  guestId: string;
  name: string | null;
  rollCode: string;
  shotsUsed: number;
  shotsLeft: number;
}

interface GuestAppProps {
  event: EventRow;
  initialRestoreCode?: string | null;
  eventToken?: string;
  tokenExpiresAt?: string | null;
  initialGuest?: InitialGuestState | null;
}

type Screen = "landing" | "camera" | "thankyou" | "closed";

export function GuestApp({
  event,
  initialRestoreCode,
  eventToken,
  tokenExpiresAt,
  initialGuest,
}: GuestAppProps) {
  const initialStatus = useMemo(() => eventStatus(event), [event]);
  const [overrideStatus, setOverrideStatus] = useState<EventStatus | null>(null);
  const status = overrideStatus ?? initialStatus;

  const [consentGranted, setConsentGranted] = useState(() => hasValidConsent());

  const [screen, setScreen] = useState<Screen>(() => {
    if (initialStatus !== "open") return "closed";
    if (initialGuest && initialGuest.shotsLeft > 0) return "camera";
    if (initialGuest && initialGuest.shotsLeft <= 0) return "thankyou";
    return "landing";
  });
  const [lang, setLang] = useState<Lang>("en");
  const [guestId, setGuestId] = useState<string | null>(() => initialGuest?.guestId ?? null);
  const [rollCode, setRollCode] = useState<string | null>(() => initialGuest?.rollCode ?? null);
  const [shotsPerGuest, setShotsPerGuest] = useState(event.shots_per_guest);
  const [shotsLeft, setShotsLeft] = useState<number>(() => initialGuest?.shotsLeft ?? event.shots_per_guest);

  const [welcomeToast, setWelcomeToast] = useState(false);
  const [freshRollToast, setFreshRollToast] = useState(false);
  const [rollExtendedToast, setRollExtendedToast] = useState(false);
  const [isCheckingRoll, setIsCheckingRoll] = useState(false);
  const prevShotsPerGuestRef = useRef(event.shots_per_guest);

  // Background IndexedDB upload queue with real-time pending badge
  // Strictly gated on consentGranted so IndexedDB is never opened before consent
  const { pendingCount, syncError, enqueue } = useQueue(guestId, consentGranted);

  // Global window unhandled error & rejection trap (strictly opt-in and post-consent)
  useEffect(() => {
    if (!consentGranted) return;
    const localConsent = getLocalConsent();
    if (!localConsent?.telemetry) return;
    const cleanup = initGlobalTelemetry(event.slug, guestId || undefined);
    return cleanup;
  }, [event.slug, guestId, consentGranted]);

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

  // Track active session for unclean exit detection (strictly after consent)
  useEffect(() => {
    if (!consentGranted || typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (wasUncleanExit(event.slug)) {
      setWelcomeToast(true);
      timer = setTimeout(() => setWelcomeToast(false), 4500);
    }
    markSessionActive(event.slug);
    return () => {
      if (timer) clearTimeout(timer);
      clearSessionActive(event.slug);
    };
  }, [event.slug, consentGranted]);

  const guestIdRef = useRef(guestId);
  guestIdRef.current = guestId;
  const sessionResolvedRef = useRef(false);

  // Sync / refresh guest data with server
  const initGuest = useCallback(
    async (
      guestName: string | null,
      targetGuestId?: string | null,
      consentParams?: { consentAlbum: boolean; consentTelemetry: boolean }
    ) => {
      try {
        const local = getLocalConsent();
        const res = await fetch("/api/guests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSlug: event.slug,
            name: guestName || undefined,
            guestId: targetGuestId !== undefined ? (targetGuestId || undefined) : (guestIdRef.current || undefined),
            consentVersion: CONSENT_VERSION,
            consentAlbum: consentParams?.consentAlbum ?? local?.album ?? true,
            consentTelemetry: consentParams?.consentTelemetry ?? local?.telemetry ?? false,
            eventToken: eventToken || undefined,
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
        // Detect if admin increased the quota on the server
        if (prevShotsPerGuestRef.current && data.shotsPerGuest > prevShotsPerGuestRef.current) {
          setRollExtendedToast(true);
          setTimeout(() => setRollExtendedToast(false), 5000);
        }
        prevShotsPerGuestRef.current = data.shotsPerGuest;
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
    [event.slug, lang, eventToken],
  );

  // Triple-Healed Multi-Session Identity & ?restore= handling on mount (strictly after consent)
  useEffect(() => {
    if (!consentGranted || status !== "open" || typeof window === "undefined") return;
    if (sessionResolvedRef.current) return;
    sessionResolvedRef.current = true;

    const resolveSession = async () => {
      // 0. Check if URL has ?reset=1 to clear session and show landing
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("reset")) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("reset");
          window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
        } catch {}
        await clearSessionTriple(event.slug);
        setGuestId(null);
        setScreen("landing");
        return;
      }

      // 1. Check if URL has ?restore=CODE
      if (initialRestoreCode) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("restore");
          window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
        } catch {}

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

      const sessionResetAt = (event.theme && typeof event.theme === "object" && "sessionResetAt" in event.theme)
        ? (event.theme as { sessionResetAt?: string | null }).sessionResetAt
        : null;

      // 2. Load triple-healed session (Cookie + localStorage + IndexedDB)
      const saved = await loadSessionTriple(event.slug);
      const activeSaved = saved || (initialGuest ? {
        guestId: initialGuest.guestId,
        name: initialGuest.name,
        lang,
        rollCode: initialGuest.rollCode,
        createdAt: new Date().toISOString(),
      } : null);

      if (activeSaved) {
        const isLocallyExpired = !!(sessionResetAt && activeSaved.createdAt && new Date(activeSaved.createdAt) < new Date(sessionResetAt));
        if (isLocallyExpired) {
          await clearSessionTriple(event.slug);
          const fresh = await initGuest(null, null);
          if (fresh && fresh.remaining > 0) {
            setScreen("camera");
            setFreshRollToast(true);
            setTimeout(() => setFreshRollToast(false), 4500);
            return;
          }
        } else {
          setLang(activeSaved.lang);
          setGuestId(activeSaved.guestId);
          setRollCode(activeSaved.rollCode || computeRollCodeFromGuestId(activeSaved.guestId));

          // Sync with server source-of-truth for accurate shot count
          const synced = await initGuest(activeSaved.name, activeSaved.guestId);
          if (synced) {
            const isFreshRoll = synced.guestId !== activeSaved.guestId;
            if (synced.remaining <= 0) {
              setScreen("thankyou");
            } else {
              setScreen("camera");
              if (isFreshRoll) {
                setFreshRollToast(true);
                setTimeout(() => setFreshRollToast(false), 4500);
              } else {
                setWelcomeToast(true);
                setTimeout(() => setWelcomeToast(false), 3500);
              }
            }
          }
        }
      }
    };

    void resolveSession();
  }, [event.slug, event.theme, initialRestoreCode, status, initGuest, lang]);

  const isSyncingRef = useRef(false);
  const checkRollSync = useCallback(async () => {
    if (status !== "open" || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsCheckingRoll(true);
    try {
      const synced = await initGuest(null, guestId || undefined);
      if (synced) {
        if (guestId && synced.guestId !== guestId) {
          // Fresh roll issued by server
          setGuestId(synced.guestId);
          setRollCode(synced.rollCode);
          setShotsLeft(synced.remaining);
          if (synced.remaining > 0) {
            setScreen("camera");
            setFreshRollToast(true);
            setTimeout(() => setFreshRollToast(false), 4500);
          }
        } else if (synced.remaining > 0 && screen === "thankyou") {
          setScreen("camera");
        }
      }
    } finally {
      setIsCheckingRoll(false);
      isSyncingRef.current = false;
    }
  }, [status, guestId, initGuest, screen]);

  // Reset document scroll on screen change
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [screen]);

  // 1. Listen to visibility change (e.g. phone unlocked or browser tab brought to foreground)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void checkRollSync();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [checkRollSync]);

  // 2. Periodic live background sync: Polls every 20s while the web page is actively in foreground
  useEffect(() => {
    if (!consentGranted || status !== "open") return;
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void checkRollSync();
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [consentGranted, status, checkRollSync]);

  // 3. Sync on upload queue completion: When all pending uploads successfully finish, sync shot count
  const prevPendingRef = useRef(pendingCount);
  useEffect(() => {
    if (prevPendingRef.current > 0 && pendingCount === 0 && consentGranted && status === "open") {
      void checkRollSync();
    }
    prevPendingRef.current = pendingCount;
  }, [pendingCount, consentGranted, status, checkRollSync]);

  const handleStartCamera = async (name: string, consent: ConsentSubmission) => {
    // Best-effort fullscreen request on user gesture (Android Chrome, ignores on iOS)
    if (typeof document !== "undefined" && document.documentElement?.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    sessionResolvedRef.current = true;
    saveLocalConsent({ album: consent.album, telemetry: consent.telemetry });
    setConsentGranted(true);

    const res = await initGuest(name || null, null, {
      consentAlbum: consent.album,
      consentTelemetry: consent.telemetry,
    });
    if (!res) return;

    if (res.remaining <= 0) {
      setScreen("thankyou");
    } else {
      setScreen("camera");
    }
  };

  const handleLanguageChange = (newLang: Lang) => {
    setLang(newLang);
    if (consentGranted) {
      void loadSessionTriple(event.slug).then((saved) => {
        if (saved) {
          void saveSessionTriple(event.slug, { ...saved, lang: newLang });
        }
      });
    }
  };

  const handleRestoreSuccess = (data: { guestId: string; name: string | null; rollCode: string; shotsLeft: number }) => {
    setConsentGranted(true);
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

  const purgeAllLocalClientState = async () => {
    clearLocalConsent();
    await clearSessionTriple(event.slug);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {}

      // Delete IndexedDB database
      if (typeof window.indexedDB !== "undefined") {
        try {
          if (window.indexedDB.databases) {
            const dbs = await window.indexedDB.databases();
            for (const db of dbs) {
              if (db.name) {
                window.indexedDB.deleteDatabase(db.name);
              }
            }
          } else {
            window.indexedDB.deleteDatabase("disposable-cam");
          }
        } catch {}
      }

      // Enforce zero localStorage items even if any component unmount microtask fires
      setTimeout(() => {
        try {
          window.localStorage.clear();
        } catch {}
      }, 0);
    }
  };

  const handleClearLocalData = async () => {
    await purgeAllLocalClientState();
    setConsentGranted(false);
    setGuestId(null);
    setRollCode(null);
    setScreen("landing");
  };

  const handleDeleteRoll = async () => {
    if (!guestId) return;
    try {
      const res = await fetch("/api/guests/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug: event.slug,
          guestId,
          rollCode: rollCode || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to delete roll. Please try again.");
        return;
      }
    } catch (e) {
      console.error("Delete roll error:", e);
    }
    await purgeAllLocalClientState();
    setConsentGranted(false);
    setGuestId(null);
    setRollCode(null);
    setScreen("landing");
  };

  // Native developing modal state
  const [nativeModalVisible, setNativeModalVisible] = useState(false);
  const [nativeProcessingState, setNativeProcessingState] = useState<NativeProcessingState>("developing");
  const [nativeThumbnail, setNativeThumbnail] = useState<string | null>(null);
  const [nativeProgress, setNativeProgress] = useState(0);
  const [nativeError, setNativeError] = useState<string | undefined>();

  // Request persistent storage (strictly after consent)
  useEffect(() => {
    if (consentGranted) {
      void requestPersistentStorage();
    }
  }, [consentGranted]);

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
      lookId?: string;
      presetId?: string;
      captureSource?: "takePhoto" | "videoFrame";
      retakenPresetIds?: string[];
    },
    baseRemaining?: number
  ) => {
    const shotId = newShotId();

    // 1. Optimistically decrement available shot counter immediately
    const currentLeft = baseRemaining !== undefined ? baseRemaining : shotsLeft;
    const nextLeft = Math.max(0, currentLeft - 1);
    setShotsLeft(nextLeft);

    // 2. Store into offline-safe IndexedDB BEFORE network request
    try {
      await addShot({
        shotId,
        eventSlug: event.slug,
        guestId: activeId,
        blob,
        thumbnailBlob: blob,
        ...metadata,
      });
    } catch (err) {
      console.warn("Failed to store shot in IndexedDB, continuing with upload:", err);
    }

    // 3. Trigger upload queue worker
    enqueue();

    if (nextLeft <= 0) {
      setTimeout(() => setScreen("thankyou"), 500);
    } else if (screen === "landing") {
      setScreen("camera");
    }
  };

  const handleShotCaptured = async (
    filteredBlob: Blob,
    originalBlob?: Blob,
    meta?: {
      presetId?: string;
      captureSource?: "takePhoto" | "videoFrame";
      retakenPresetIds?: string[];
    }
  ) => {
    if (!guestId || shotsLeft <= 0) return;
    const shouldKeepOriginal = (event as any).dual_master_enabled !== false;
    await recordShot(filteredBlob, guestId, {
      originalBlob: shouldKeepOriginal ? originalBlob : undefined,
      source: "inapp",
      tier: "high",
      filtered: true,
      lookId: meta?.presetId || "disposable-400",
      presetId: meta?.presetId || "disposable-400",
      captureSource: meta?.captureSource || "videoFrame",
      retakenPresetIds: meta?.retakenPresetIds || [],
    });
  };

  const handleNativePhoto = async (
    file: File,
    explicitName: string | null = null,
    quickThumb?: string,
    consent?: ConsentSubmission
  ) => {
    if (consent) {
      saveLocalConsent({ album: consent.album, telemetry: consent.telemetry });
      setConsentGranted(true);
    }
    clearNativePending(event.slug);

    // Instant UI feedback (<150ms): show developing modal immediately
    const thumbUrl = quickThumb || URL.createObjectURL(file);
    setNativeThumbnail(thumbUrl);
    setNativeProcessingState("developing");
    setNativeProgress(15);
    setNativeError(undefined);
    setNativeModalVisible(true);

    try {
      let activeId = guestId;
      let currentRemaining = shotsLeft;
      if (!activeId) {
        const res = await initGuest(
          explicitName,
          null,
          consent ? { consentAlbum: consent.album, consentTelemetry: consent.telemetry } : undefined
        );
        if (!res) {
          throw new Error("Could not start session. Please check your connection and try again.");
        }
        if (res.remaining <= 0) {
          setNativeModalVisible(false);
          setScreen("thankyou");
          return;
        }
        activeId = res.guestId;
        currentRemaining = res.remaining;
      }

      if (currentRemaining <= 0) {
        setNativeModalVisible(false);
        setScreen("thankyou");
        return;
      }

      const { defaultLookId } = resolveThemeLooks(event.theme);
      const activeLook = getLookById(defaultLookId) ?? CPM35_LOOK;

      let finalBlob: Blob = file;
      let finalWidth: number | undefined;
      let finalHeight: number | undefined;
      let isFiltered = false;

      try {
        const processed = await processImageOffThread(file, {
          maxEdge: 2560,
          quality: 0.90,
          applyFilter: true,
          look: activeLook,
          onProgress: (stage) => {
            if (stage === "decoding") setNativeProgress(35);
            if (stage === "filtering") setNativeProgress(60);
            if (stage === "encoding") setNativeProgress(80);
          },
        });
        finalBlob = processed.blob;
        finalWidth = processed.width;
        finalHeight = processed.height;
        isFiltered = true;
      } catch (filterErr) {
        console.warn("Filter processing failed for native photo, saving original directly:", filterErr);
      }

      setNativeProcessingState("saving");
      setNativeProgress(92);

      const shouldKeepOriginal = (event as any).dual_master_enabled !== false;

      // Save processed photo to queue with original file attached as clean original (if dual master enabled)
      await recordShot(
        finalBlob,
        activeId,
        {
          originalBlob: shouldKeepOriginal ? file : undefined, // clean original uploaded to "originals" in background
          width: finalWidth,
          height: finalHeight,
          source: "native",
          tier: "original",
          filtered: isFiltered,
        },
        currentRemaining
      );

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

      {freshRollToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-amber-950/95 border border-amber-400/60 rounded-full shadow-2xl flex items-center gap-2 text-amber-200 text-xs font-mono animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>
            {t(lang, "freshRollToast", { n: shotsLeft })}
          </span>
        </div>
      )}

      {rollExtendedToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-amber-950/95 border border-amber-400/60 rounded-full shadow-2xl flex items-center gap-2 text-amber-200 text-xs font-mono animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>
            {lang === "id"
              ? `Rol diperpanjang menjadi ${shotsPerGuest} foto! (Sisa ${shotsLeft})`
              : `Roll extended to ${shotsPerGuest} photos! (${shotsLeft} remaining)`}
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
          onCheckRoll={checkRollSync}
          isCheckingRoll={isCheckingRoll}
          onDeleteRoll={handleDeleteRoll}
        />
      )}

      {screen === "camera" && (
        <CameraScreen
          eventSlug={event.slug}
          coupleNames={event.couple_names}
          shotsLeft={shotsLeft}
          totalShots={shotsPerGuest}
          pendingCount={pendingCount}
          syncError={syncError}
          guestId={guestId}
          rollCode={rollCode}
          lang={lang}
          onShotCaptured={handleShotCaptured}
          onNativePhoto={handleNativePhoto}
          allowedLookIds={resolveThemeLooks(event.theme).allowedLookIds}
          defaultLookId={resolveThemeLooks(event.theme).defaultLookId}
          onDeleteRoll={handleDeleteRoll}
        />
      )}

      {screen === "landing" && (() => {
        const themeObj = event.theme && typeof event.theme === "object" ? (event.theme as Record<string, unknown>) : null;
        const eventSubtitle = typeof themeObj?.eventSubtitle === "string" && themeObj.eventSubtitle.trim()
          ? themeObj.eventSubtitle.trim()
          : undefined;

        return (
          <LandingScreen
            coupleNames={event.couple_names}
            eventSubtitle={eventSubtitle}
            shotsPerGuest={shotsPerGuest}
            eventSlug={event.slug}
            tokenExpiresAt={tokenExpiresAt}
            lang={lang}
            hasActiveRoll={Boolean(guestId)}
            onLanguageChange={handleLanguageChange}
            onStartCamera={handleStartCamera}
            onNativePhoto={handleNativePhoto}
            onRestoreSuccess={handleRestoreSuccess}
          />
        );
      })()}
    </GuestErrorBoundary>
  );
}
