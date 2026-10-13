/**
 * Adaptive Performance Controller for Viewfinder & Camera Pipeline
 *
 * Implements a 4-tier adaptive ladder (A, B, C, D) with hysteresis,
 * per-device persistence, URL override, and gesture/capture stability guards.
 *
 * Tiers:
 * - A (Ultra): 1280px preview long edge, 24 Hz discrete grain tick, full bloom
 * - B (Standard): 960px preview long edge, 24 Hz grain tick, full bloom
 * - C (Lite): 720px preview long edge, static grain (no tick), half-res bloom
 * - D (Eco): 640px preview long edge, disabled grain animation, bloom off
 */

export type QualityTier = "A" | "B" | "C" | "D";
export type PerformanceMode = "auto" | "quality" | "smooth";

export interface TierConfig {
  tier: QualityTier;
  name: string;
  previewLongEdge: number;
  animatedGrain: boolean;
  grainTickHz: number;
  bloomResolutionFactor: number;
  fpsTarget: number;
}

export const TIER_CONFIGS: Record<QualityTier, TierConfig> = {
  A: {
    tier: "A",
    name: "Ultra",
    previewLongEdge: 1280,
    animatedGrain: true,
    grainTickHz: 24,
    bloomResolutionFactor: 1.0,
    fpsTarget: 30,
  },
  B: {
    tier: "B",
    name: "Standard",
    previewLongEdge: 960,
    animatedGrain: true,
    grainTickHz: 24,
    bloomResolutionFactor: 1.0,
    fpsTarget: 30,
  },
  C: {
    tier: "C",
    name: "Lite",
    previewLongEdge: 720,
    animatedGrain: false,
    grainTickHz: 0,
    bloomResolutionFactor: 0.5,
    fpsTarget: 30,
  },
  D: {
    tier: "D",
    name: "Eco",
    previewLongEdge: 640,
    animatedGrain: false,
    grainTickHz: 0,
    bloomResolutionFactor: 0.0,
    fpsTarget: 30,
  },
};

const STORAGE_KEY_TIER = "dc:perf_tier";
const STORAGE_KEY_MODE = "dc:perf_mode";

/**
 * Resolves initial performance mode: URL `?perf=` > localStorage > "auto"
 */
export function resolveInitialPerfMode(): PerformanceMode {
  if (typeof window === "undefined") return "auto";
  try {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get("perf")?.toLowerCase();
    if (urlMode === "auto" || urlMode === "quality" || urlMode === "smooth") {
      return urlMode as PerformanceMode;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY_MODE);
    if (stored === "auto" || stored === "quality" || stored === "smooth") {
      return stored as PerformanceMode;
    }
  } catch {
    /* ignore storage access issues */
  }
  return "auto";
}

/**
 * Resolves initial tier: URL `?tier=` > localStorage > default "A"
 */
export function resolveInitialTier(mode: PerformanceMode = "auto"): QualityTier {
  if (mode === "quality") return "A";
  if (mode === "smooth") return "C";

  if (typeof window === "undefined") return "A";
  try {
    const params = new URLSearchParams(window.location.search);
    const urlTier = params.get("tier")?.toUpperCase();
    if (urlTier === "A" || urlTier === "B" || urlTier === "C" || urlTier === "D") {
      return urlTier as QualityTier;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY_TIER);
    if (stored === "A" || stored === "B" || stored === "C" || stored === "D") {
      return stored as QualityTier;
    }
  } catch {
    /* ignore */
  }
  return "A";
}

export function savePerfPreferences(mode: PerformanceMode, tier: QualityTier): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY_MODE, mode);
    window.localStorage.setItem(STORAGE_KEY_TIER, tier);
  } catch {
    /* ignore */
  }
}

export interface AdaptiveControllerState {
  mode: PerformanceMode;
  tier: QualityTier;
  config: TierConfig;
  measuredFps: number;
  p95FrameTimeMs: number;
}

export class AdaptivePerformanceController {
  private mode: PerformanceMode;
  private currentTier: QualityTier;
  private frameTimes: number[] = [];
  private lastTierChangeTime: number = 0;
  private sustainedDowngradeStart: number | null = null;
  private sustainedUpgradeStart: number | null = null;
  private p95FrameTime: number = 16.6;
  private measuredFps: number = 60;
  private onTierChange?: (tier: QualityTier, config: TierConfig) => void;

  constructor(
    initialMode?: PerformanceMode,
    initialTier?: QualityTier,
    onTierChange?: (tier: QualityTier, config: TierConfig) => void
  ) {
    this.mode = initialMode ?? resolveInitialPerfMode();
    this.currentTier = initialTier ?? resolveInitialTier(this.mode);
    this.onTierChange = onTierChange;
    this.lastTierChangeTime = typeof performance !== "undefined" ? performance.now() : 0;
  }

  public getMode(): PerformanceMode {
    return this.mode;
  }

  public setMode(mode: PerformanceMode): void {
    this.mode = mode;
    if (mode === "quality") {
      this.setTier("A");
    } else if (mode === "smooth") {
      this.setTier("C");
    }
    savePerfPreferences(this.mode, this.currentTier);
  }

  public getTier(): QualityTier {
    return this.currentTier;
  }

  public getConfig(): TierConfig {
    return TIER_CONFIGS[this.currentTier];
  }

  public setTier(tier: QualityTier): void {
    if (this.currentTier === tier) return;
    this.currentTier = tier;
    this.lastTierChangeTime = typeof performance !== "undefined" ? performance.now() : 0;
    this.sustainedDowngradeStart = null;
    this.sustainedUpgradeStart = null;
    savePerfPreferences(this.mode, this.currentTier);
    this.onTierChange?.(this.currentTier, TIER_CONFIGS[this.currentTier]);
  }

  public getTelemetry(): { measuredFps: number; p95FrameTimeMs: number } {
    return {
      measuredFps: this.measuredFps,
      p95FrameTimeMs: Math.round(this.p95FrameTime * 10) / 10,
    };
  }

  /**
   * Processes each rendered frame duration.
   *
   * Invariants:
   * - Never changes tier while isCapturing or isGesturing is true.
   * - Downgrades after p95 frame time > 1.25x target for >= 2000ms.
   * - Upgrades after sustained headroom for >= 10000ms.
   */
  public recordFrame(
    deltaMs: number,
    now: number,
    isCapturing: boolean = false,
    isGesturing: boolean = false
  ): void {
    if (deltaMs <= 0 || deltaMs > 500) return;

    this.frameTimes.push(deltaMs);
    if (this.frameTimes.length > 30) {
      this.frameTimes.shift();
    }

    // Compute average FPS and p95 frame time
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    this.p95FrameTime = sorted[p95Index] ?? deltaMs;

    const avgMs = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.measuredFps = Math.round(1000 / Math.max(1, avgMs));

    // Do not adapt tier if mode is locked to quality/smooth, or during capture/gestures
    if (this.mode !== "auto" || isCapturing || isGesturing) {
      this.sustainedDowngradeStart = null;
      this.sustainedUpgradeStart = null;
      return;
    }

    // Hysteresis constants:
    // Target interval: 33.3ms (30 fps). Downgrade trigger: > 1.25 * 33.3ms = 41.6ms (< 24 fps).
    const DOWNGRADE_THRESHOLD_MS = 41.6;
    const DOWNGRADE_SUSTAIN_MS = 2000;

    // Upgrade trigger: sustained p95 frame time < 28.0ms (> 35 fps)
    const UPGRADE_THRESHOLD_MS = 28.0;
    const UPGRADE_SUSTAIN_MS = 10000;

    // Check Downgrade condition
    if (this.p95FrameTime > DOWNGRADE_THRESHOLD_MS) {
      this.sustainedUpgradeStart = null;
      if (this.sustainedDowngradeStart === null) {
        this.sustainedDowngradeStart = now;
      } else if (now - this.sustainedDowngradeStart >= DOWNGRADE_SUSTAIN_MS) {
        this.downgradeTier();
      }
    } else {
      this.sustainedDowngradeStart = null;
    }

    // Check Upgrade condition
    if (this.p95FrameTime < UPGRADE_THRESHOLD_MS) {
      if (this.sustainedUpgradeStart === null) {
        this.sustainedUpgradeStart = now;
      } else if (now - this.sustainedUpgradeStart >= UPGRADE_SUSTAIN_MS) {
        this.upgradeTier();
      }
    } else {
      this.sustainedUpgradeStart = null;
    }
  }

  private downgradeTier(): void {
    if (this.currentTier === "A") this.setTier("B");
    else if (this.currentTier === "B") this.setTier("C");
    else if (this.currentTier === "C") this.setTier("D");
  }

  private upgradeTier(): void {
    if (this.currentTier === "D") this.setTier("C");
    else if (this.currentTier === "C") this.setTier("B");
    else if (this.currentTier === "B") this.setTier("A");
  }
}
