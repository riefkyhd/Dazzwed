"use client";

import { useEffect, useState, useCallback } from "react";
import { uploadQueue } from "./uploader";
import { getPendingShots } from "./store";

export function useQueue(guestId?: string | null) {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    // Initial fetch of pending items
    void getPendingShots(guestId || undefined).then((items) => {
      setPending(items.length);
    });

    // Subscribe to live queue updates
    const unsubscribe = uploadQueue.subscribe((count) => {
      setPending(count);
    });

    // Kick queue processing when hook initializes (e.g. tab reload / app reopen)
    uploadQueue.drain();

    return () => {
      unsubscribe();
    };
  }, [guestId]);

  const enqueue = useCallback(() => {
    uploadQueue.drain();
  }, []);

  return {
    pendingCount: pending,
    enqueue,
    retryNow: () => uploadQueue.resetDelaysAndDrain(),
  };
}
