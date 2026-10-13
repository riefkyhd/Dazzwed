"use client";

import { useEffect, useState, useCallback } from "react";
import { uploadQueue } from "./uploader";
import { getPendingShots } from "./store";

export function useQueue(guestId?: string | null) {
  const [pending, setPending] = useState(0);
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    // Initial fetch of pending items
    void getPendingShots(guestId || undefined).then((items) => {
      setPending(items.length);
    });

    // Subscribe to live queue updates
    const unsubscribe = uploadQueue.subscribe((count) => {
      setPending(count);
    });

    // Subscribe to drive connection status
    const unsubDrive = uploadQueue.subscribeDriveStatus((disconnected) => {
      setSyncError(disconnected);
    });

    // Kick queue processing when hook initializes (e.g. tab reload / app reopen)
    uploadQueue.drain();

    return () => {
      unsubscribe();
      unsubDrive();
    };
  }, [guestId]);

  const enqueue = useCallback(() => {
    uploadQueue.drain();
  }, []);

  return {
    pendingCount: pending,
    syncError,
    enqueue,
    retryNow: () => uploadQueue.resetDelaysAndDrain(),
  };
}
