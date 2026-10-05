/** Trigger subtle haptic vibration if supported by device */
export function triggerHaptic(pattern: number | number[] = 35): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported/blocked haptic errors
  }
}
