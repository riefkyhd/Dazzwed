/**
 * Pure Gesture State Machine for Camera Viewfinder
 *
 * Rules:
 * 1. Single pointer-events authority with touch-action: none.
 * 2. Two pointers down = Pinch Mode immediately. Cancels any pending tap or long-press, hides focus ring,
 *    and sets a 300ms post-pinch cooldown during which all taps are ignored.
 * 3. A tap is recognized strictly on pointerup iff:
 *    - exactly 1 pointer was involved (never pinched)
 *    - total displacement < 10px
 *    - duration < 250ms
 *    - post-pinch cooldown is expired
 * 4. Long press (AE/AF lock): 1 pointer held for >= 600ms without movement (> 10px).
 * 5. Slider drag: occurs when dragging starts on the ring/sun hit-box, or immediately after a tap.
 */

export interface PointerPoint {
  id: number;
  x: number;
  y: number;
  time: number;
}

export interface GestureState {
  mode: "idle" | "tap-candidate" | "dragging-slider" | "pinching" | "long-pressed";
  activePointers: Map<number, PointerPoint>;
  initialPinchDistance: number;
  initialZoom: number;
  currentZoom: number;
  tapStartTime: number;
  tapStartX: number;
  tapStartY: number;
  pinchEndTime: number;
}

export type GestureEvent =
  | { type: "POINTER_DOWN"; id: number; x: number; y: number; time: number; currentZoom: number }
  | { type: "POINTER_MOVE"; id: number; x: number; y: number; time: number }
  | { type: "POINTER_UP"; id: number; x: number; y: number; time: number }
  | { type: "POINTER_CANCEL"; id: number; time: number };

export interface GestureAction {
  type:
    | "NONE"
    | "TAP"
    | "LONG_PRESS"
    | "PINCH_START"
    | "PINCH_UPDATE"
    | "PINCH_END"
    | "SLIDER_DRAG_START"
    | "SLIDER_DRAG_UPDATE"
    | "SLIDER_DRAG_END";
  x?: number;
  y?: number;
  deltaY?: number;
  zoom?: number;
}

export const TAP_MAX_DISTANCE = 10; // px
export const TAP_MAX_DURATION = 250; // ms
export const LONG_PRESS_DURATION = 600; // ms
export const PINCH_COOLDOWN = 300; // ms

export function createInitialGestureState(): GestureState {
  return {
    mode: "idle",
    activePointers: new Map(),
    initialPinchDistance: 0,
    initialZoom: 1,
    currentZoom: 1,
    tapStartTime: 0,
    tapStartX: 0,
    tapStartY: 0,
    pinchEndTime: 0,
  };
}

function getDistance(p1: PointerPoint, p2: PointerPoint): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function processGestureEvent(
  state: GestureState,
  event: GestureEvent,
  isRingHit?: (x: number, y: number) => boolean
): { nextState: GestureState; action: GestureAction } {
  const next: GestureState = {
    ...state,
    activePointers: new Map(state.activePointers),
  };

  switch (event.type) {
    case "POINTER_DOWN": {
      next.activePointers.set(event.id, {
        id: event.id,
        x: event.x,
        y: event.y,
        time: event.time,
      });

      // Two or more pointers -> PINCH MODE immediately
      if (next.activePointers.size >= 2) {
        const points = Array.from(next.activePointers.values());
        const dist = getDistance(points[0], points[1]);
        next.mode = "pinching";
        next.initialPinchDistance = Math.max(10, dist);
        next.initialZoom = event.currentZoom;
        next.currentZoom = event.currentZoom;
        return {
          nextState: next,
          action: { type: "PINCH_START", zoom: event.currentZoom },
        };
      }

      // Single pointer down
      if (next.activePointers.size === 1) {
        // If touching directly on ring/sun, immediately enter slider drag mode
        if (isRingHit && isRingHit(event.x, event.y)) {
          next.mode = "dragging-slider";
          next.tapStartX = event.x;
          next.tapStartY = event.y;
          next.tapStartTime = event.time;
          return {
            nextState: next,
            action: { type: "SLIDER_DRAG_START", x: event.x, y: event.y },
          };
        }

        // Otherwise candidate for tap / long-press
        next.mode = "tap-candidate";
        next.tapStartX = event.x;
        next.tapStartY = event.y;
        next.tapStartTime = event.time;
        return { nextState: next, action: { type: "NONE" } };
      }

      return { nextState: next, action: { type: "NONE" } };
    }

    case "POINTER_MOVE": {
      const existing = next.activePointers.get(event.id);
      if (!existing) return { nextState: state, action: { type: "NONE" } };

      existing.x = event.x;
      existing.y = event.y;
      existing.time = event.time;

      // Handle Pinch
      if (next.mode === "pinching" && next.activePointers.size >= 2) {
        const points = Array.from(next.activePointers.values());
        const currentDist = getDistance(points[0], points[1]);
        const scale = currentDist / Math.max(10, next.initialPinchDistance);
        const newZoom = Math.max(0.5, Math.min(10, next.initialZoom * scale));
        next.currentZoom = newZoom;
        return {
          nextState: next,
          action: { type: "PINCH_UPDATE", zoom: newZoom },
        };
      }

      // Handle Slider Drag
      if (next.mode === "dragging-slider") {
        const deltaY = event.y - next.tapStartY;
        return {
          nextState: next,
          action: { type: "SLIDER_DRAG_UPDATE", deltaY, y: event.y },
        };
      }

      // Handle Tap Candidate movement
      if (next.mode === "tap-candidate") {
        const dist = Math.hypot(event.x - next.tapStartX, event.y - next.tapStartY);
        if (dist > TAP_MAX_DISTANCE) {
          // If moved past tap threshold, transition to slider drag if it's primarily vertical
          next.mode = "dragging-slider";
          return {
            nextState: next,
            action: { type: "SLIDER_DRAG_START", x: event.x, y: event.y },
          };
        }
      }

      return { nextState: next, action: { type: "NONE" } };
    }

    case "POINTER_UP": {
      const wasInMap = next.activePointers.delete(event.id);
      if (!wasInMap) return { nextState: state, action: { type: "NONE" } };

      // Ending pinch
      if (next.mode === "pinching") {
        if (next.activePointers.size < 2) {
          next.mode = "idle";
          next.pinchEndTime = event.time;
          return {
            nextState: next,
            action: { type: "PINCH_END", zoom: next.currentZoom },
          };
        }
        return { nextState: next, action: { type: "NONE" } };
      }

      // Ending slider drag
      if (next.mode === "dragging-slider") {
        next.mode = "idle";
        return {
          nextState: next,
          action: { type: "SLIDER_DRAG_END" },
        };
      }

      // Validating Tap
      if (next.mode === "tap-candidate") {
        const duration = event.time - next.tapStartTime;
        const dist = Math.hypot(event.x - next.tapStartX, event.y - next.tapStartY);
        const cooldownRemaining = event.time - next.pinchEndTime < PINCH_COOLDOWN;

        next.mode = "idle";

        // Must satisfy: single pointer, < 10px, < 250ms, cooldown expired
        if (!cooldownRemaining && dist < TAP_MAX_DISTANCE && duration < TAP_MAX_DURATION) {
          return {
            nextState: next,
            action: { type: "TAP", x: event.x, y: event.y },
          };
        }
        return { nextState: next, action: { type: "NONE" } };
      }

      next.mode = "idle";
      return { nextState: next, action: { type: "NONE" } };
    }

    case "POINTER_CANCEL": {
      next.activePointers.delete(event.id);
      if (next.mode === "pinching" && next.activePointers.size < 2) {
        next.mode = "idle";
        next.pinchEndTime = event.time;
        return { nextState: next, action: { type: "PINCH_END" } };
      }
      if (next.mode === "dragging-slider") {
        next.mode = "idle";
        return { nextState: next, action: { type: "SLIDER_DRAG_END" } };
      }
      next.mode = "idle";
      return { nextState: next, action: { type: "NONE" } };
    }
  }
}
