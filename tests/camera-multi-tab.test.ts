import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CameraTabCoordinator, type CameraBusMessage } from "@/lib/camera/camera-tab-lock";

describe("CameraTabCoordinator (Cross-Tab Camera Lock)", () => {
  let mockChannels: Map<string, Set<(evt: MessageEvent<CameraBusMessage>) => void>>;
  let originalBroadcastChannel: typeof BroadcastChannel | undefined;
  let originalWindow: typeof window | undefined;
  let originalLocalStorage: typeof localStorage | undefined;

  beforeEach(() => {
    mockChannels = new Map();
    originalBroadcastChannel = globalThis.BroadcastChannel;
    originalWindow = globalThis.window;
    originalLocalStorage = globalThis.localStorage;

    const windowListeners = new Map<string, Set<EventListener>>();
    const mockStorage = new Map<string, string>();

    // Mock minimal browser window environment
    globalThis.window = {
      addEventListener: (type: string, fn: unknown) => {
        if (!windowListeners.has(type)) windowListeners.set(type, new Set());
        windowListeners.get(type)!.add(fn as EventListener);
      },
      removeEventListener: (type: string, fn: unknown) => {
        windowListeners.get(type)?.delete(fn as EventListener);
      },
      dispatchEvent: (evt: Event) => {
        windowListeners.get(evt.type)?.forEach((fn) => fn(evt));
        return true;
      },
    } as unknown as Window & typeof globalThis;

    // @ts-expect-error test localStorage mock
    globalThis.localStorage = {
      getItem: (k: string) => mockStorage.get(k) ?? null,
      setItem: vi.fn((k: string, v: string) => {
        mockStorage.set(k, v);
      }),
      removeItem: (k: string) => mockStorage.delete(k),
      clear: () => mockStorage.clear(),
    };

    // In-memory mock for BroadcastChannel
    class MockBroadcastChannel {
      public name: string;
      public onmessage: ((evt: MessageEvent<CameraBusMessage>) => void) | null = null;

      constructor(name: string) {
        this.name = name;
        if (!mockChannels.has(name)) {
          mockChannels.set(name, new Set());
        }
        mockChannels.get(name)!.add((evt) => {
          if (this.onmessage) this.onmessage(evt);
        });
      }

      postMessage(data: CameraBusMessage) {
        const listeners = mockChannels.get(this.name);
        if (listeners) {
          // Broadcast to all other instances
          listeners.forEach((fn) => {
            if (fn !== this.onmessage) {
              fn(new MessageEvent("message", { data }));
            }
          });
        }
      }

      close() {
        if (this.onmessage) {
          mockChannels.get(this.name)?.delete(this.onmessage);
        }
      }
    }

    // @ts-expect-error Mocking BroadcastChannel for test environment
    globalThis.BroadcastChannel = MockBroadcastChannel;
  });

  afterEach(() => {
    if (originalBroadcastChannel) {
      globalThis.BroadcastChannel = originalBroadcastChannel;
    } else {
      // @ts-expect-error restore
      delete globalThis.BroadcastChannel;
    }
    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      // @ts-expect-error restore
      delete globalThis.window;
    }
    if (originalLocalStorage) {
      globalThis.localStorage = originalLocalStorage;
    } else {
      // @ts-expect-error restore
      delete globalThis.localStorage;
    }
  });

  it("assigns a unique tabId to each coordinator instance", () => {
    const tab1 = new CameraTabCoordinator();
    const tab2 = new CameraTabCoordinator();
    expect(tab1.tabId).toBeDefined();
    expect(tab2.tabId).toBeDefined();
    expect(tab1.tabId).not.toBe(tab2.tabId);
    tab1.destroy();
    tab2.destroy();
  });

  it("notifies Tab 1 when Tab 2 claims the camera", async () => {
    const tab1 = new CameraTabCoordinator("tab_1");
    const tab2 = new CameraTabCoordinator("tab_2");

    const onClaimSpy = vi.fn();
    tab1.subscribe({ onClaim: onClaimSpy });

    // Tab 2 claims the camera
    const claimPromise = tab2.claimCamera(100);

    // Tab 1 should receive the claim
    expect(onClaimSpy).toHaveBeenCalledWith("tab_2");

    // Tab 1 yields and informs Tab 2
    tab1.notifyYielded("tab_2");

    await claimPromise;

    tab1.destroy();
    tab2.destroy();
  });

  it("broadcasts active status and owner change", () => {
    const tab1 = new CameraTabCoordinator("tab_1");
    const tab2 = new CameraTabCoordinator("tab_2");

    const ownerSpy = vi.fn();
    tab1.subscribe({ onActiveOwnerChange: ownerSpy });

    tab2.notifyActive();

    expect(ownerSpy).toHaveBeenCalledWith("tab_2");

    tab1.destroy();
    tab2.destroy();
  });

  it("handles clean release on tab destroy", () => {
    const tab1 = new CameraTabCoordinator("tab_1");
    const tab2 = new CameraTabCoordinator("tab_2");

    const ownerSpy = vi.fn();
    tab1.subscribe({ onActiveOwnerChange: ownerSpy });

    tab2.notifyActive();
    expect(ownerSpy).toHaveBeenCalledWith("tab_2");

    // Tab 2 closes / destroys
    tab2.destroy();

    expect(ownerSpy).toHaveBeenCalledWith("");

    tab1.destroy();
  });

  it("gracefully falls back when BroadcastChannel is unavailable", async () => {
    // @ts-expect-error simulate old browser without BroadcastChannel
    delete globalThis.BroadcastChannel;

    const tab = new CameraTabCoordinator("tab_legacy");
    await tab.claimCamera(50);

    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(
      "dazzwed_camera_msg",
      expect.stringContaining("CLAIM_CAMERA")
    );

    tab.destroy();
  });
});
