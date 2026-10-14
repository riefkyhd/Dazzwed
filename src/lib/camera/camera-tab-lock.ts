"use client";

/**
 * Inter-tab Camera Lease Coordinator for Unveiled.
 *
 * Coordinates physical camera sensor access across multiple browser tabs to prevent
 * hardware contention errors (NotReadableError / TrackStartError) on Android (Camera2)
 * and iOS (AVFoundation).
 *
 * Transports:
 * 1. Native BroadcastChannel ("dazzwed_camera_bus")
 * 2. Window storage events (localStorage fallback for older Safari / webviews)
 */

export type CameraBusMessage =
  | { type: "CLAIM_CAMERA"; requesterTabId: string; timestamp: number }
  | { type: "CAMERA_YIELDED"; fromTabId: string; toTabId: string }
  | { type: "CAMERA_ACTIVE"; ownerTabId: string; timestamp: number }
  | { type: "RELEASE_CAMERA"; tabId: string };

function generateTabId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `tab_${crypto.randomUUID().slice(0, 8)}_${Date.now().toString(36)}`;
  }
  return `tab_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

const CHANNEL_NAME = "dazzwed_camera_bus";
const STORAGE_KEY = "dazzwed_camera_msg";

export class CameraTabCoordinator {
  public readonly tabId: string;
  private channel: BroadcastChannel | null = null;
  private listeners: {
    onClaim?: (requesterTabId: string) => void;
    onYielded?: (fromTabId: string) => void;
    onActiveOwnerChange?: (ownerTabId: string) => void;
  } = {};
  private currentOwner: string | null = null;
  private isDestroyed = false;

  constructor(tabId?: string) {
    this.tabId = tabId || generateTabId();
    this.initTransport();
  }

  private initTransport() {
    if (typeof window === "undefined") return;

    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (evt: MessageEvent<CameraBusMessage>) => {
          this.handleIncomingMessage(evt.data);
        };
      } catch {
        this.channel = null;
      }
    }

    // Always listen to storage events as a redundant fallback
    window.addEventListener("storage", this.handleStorageEvent);

    // Ensure clean teardown when tab closes
    window.addEventListener("pagehide", this.handleUnload);
    window.addEventListener("beforeunload", this.handleUnload);
  }

  private handleStorageEvent = (evt: StorageEvent) => {
    if (evt.key !== STORAGE_KEY || !evt.newValue) return;
    try {
      const parsed = JSON.parse(evt.newValue) as CameraBusMessage & { _t?: number };
      this.handleIncomingMessage(parsed);
    } catch {
      /* ignore malformed payload */
    }
  };

  private handleIncomingMessage(msg: CameraBusMessage) {
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "CLAIM_CAMERA":
        if (msg.requesterTabId !== this.tabId) {
          this.listeners.onClaim?.(msg.requesterTabId);
        }
        break;

      case "CAMERA_YIELDED":
        if (msg.toTabId === this.tabId) {
          this.listeners.onYielded?.(msg.fromTabId);
        }
        break;

      case "CAMERA_ACTIVE":
        this.currentOwner = msg.ownerTabId;
        this.listeners.onActiveOwnerChange?.(msg.ownerTabId);
        break;

      case "RELEASE_CAMERA":
        if (this.currentOwner === msg.tabId) {
          this.currentOwner = null;
          this.listeners.onActiveOwnerChange?.("");
        }
        break;
    }
  }

  public postMessage(msg: CameraBusMessage) {
    if (typeof window === "undefined" || this.isDestroyed) return;

    if (this.channel) {
      try {
        this.channel.postMessage(msg);
        return;
      } catch {
        /* broadcast channel error fallback */
      }
    }

    // Only update localStorage as a fallback if BroadcastChannel is unavailable
    try {
      if (msg.type === "RELEASE_CAMERA") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...msg, _t: Date.now() }));
      }
    } catch {
      /* ignore quota or private browsing errors */
    }
  }

  /**
   * Request that any other tab holding the camera sensor release it immediately.
   * Returns a promise that resolves after the other tab acknowledges yield or after
   * a safe cooldown for mobile OS hardware sensor teardown.
   */
  public async claimCamera(timeoutMs = 280): Promise<void> {
    if (typeof window === "undefined") return;

    return new Promise<void>((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, timeoutMs);

      // If another tab actively replies with CAMERA_YIELDED to our tabId, resolve early with Camera2 driver cooldown
      const prevOnYield = this.listeners.onYielded;
      this.listeners.onYielded = (fromTabId) => {
        prevOnYield?.(fromTabId);
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          setTimeout(resolve, 250); // safe OS Camera2 driver buffer flush cooldown
        }
      };

      this.postMessage({
        type: "CLAIM_CAMERA",
        requesterTabId: this.tabId,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Notify other tabs that this tab has yielded the camera.
   */
  public notifyYielded(toTabId: string) {
    this.postMessage({
      type: "CAMERA_YIELDED",
      fromTabId: this.tabId,
      toTabId,
    });
  }

  /**
   * Notify other tabs that this tab has successfully acquired the physical camera stream.
   */
  public notifyActive() {
    this.currentOwner = this.tabId;
    this.postMessage({
      type: "CAMERA_ACTIVE",
      ownerTabId: this.tabId,
      timestamp: Date.now(),
    });
  }

  /**
   * Notify other tabs that this tab has stopped/released the camera stream.
   */
  public notifyReleased() {
    if (this.currentOwner === this.tabId) {
      this.currentOwner = null;
    }
    this.postMessage({
      type: "RELEASE_CAMERA",
      tabId: this.tabId,
    });
  }

  public subscribe(callbacks: {
    onClaim?: (requesterTabId: string) => void;
    onYielded?: (fromTabId: string) => void;
    onActiveOwnerChange?: (ownerTabId: string) => void;
  }) {
    this.listeners = { ...this.listeners, ...callbacks };
    return () => {
      this.listeners = {};
    };
  }

  private handleUnload = () => {
    this.notifyReleased();
  };

  public destroy() {
    this.isDestroyed = true;
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", this.handleStorageEvent);
      window.removeEventListener("pagehide", this.handleUnload);
      window.removeEventListener("beforeunload", this.handleUnload);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    if (this.channel) {
      try {
        this.channel.postMessage({ type: "RELEASE_CAMERA", tabId: this.tabId });
        this.channel.close();
      } catch {
        /* ignore */
      }
      this.channel = null;
    }
  }
}

let globalCoordinator: CameraTabCoordinator | null = null;

export function getCameraCoordinator(): CameraTabCoordinator {
  if (!globalCoordinator) {
    globalCoordinator = new CameraTabCoordinator();
  }
  return globalCoordinator;
}
