import { describe, it, expect } from "vitest";
import {
  createInitialGestureState,
  processGestureEvent,
  PINCH_COOLDOWN,
} from "@/lib/camera/gesture-machine";

describe("Viewfinder Gesture State Machine", () => {
  it("recognizes a clean tap when displacement < 10px and duration < 250ms", () => {
    let state = createInitialGestureState();

    const downRes = processGestureEvent(state, {
      type: "POINTER_DOWN",
      id: 1,
      x: 100,
      y: 200,
      time: 1000,
      currentZoom: 1,
    });
    state = downRes.nextState;
    expect(downRes.action.type).toBe("NONE");
    expect(state.mode).toBe("tap-candidate");

    const upRes = processGestureEvent(state, {
      type: "POINTER_UP",
      id: 1,
      x: 102,
      y: 201,
      time: 1120, // 120ms duration (< 250ms)
    });
    expect(upRes.action.type).toBe("TAP");
    expect(upRes.action.x).toBe(102);
    expect(upRes.action.y).toBe(201);
  });

  it("rejects a tap if displacement exceeds 10px", () => {
    let state = createInitialGestureState();

    state = processGestureEvent(state, {
      type: "POINTER_DOWN",
      id: 1,
      x: 100,
      y: 200,
      time: 1000,
      currentZoom: 1,
    }).nextState;

    state = processGestureEvent(state, {
      type: "POINTER_MOVE",
      id: 1,
      x: 100,
      y: 230, // moved 30px
      time: 1050,
    }).nextState;

    const upRes = processGestureEvent(state, {
      type: "POINTER_UP",
      id: 1,
      x: 100,
      y: 230,
      time: 1100,
    });
    expect(upRes.action.type).toBe("SLIDER_DRAG_END"); // was dragging, not tap
  });

  it("transitions to Pinch Mode immediately on 2nd pointer down", () => {
    let state = createInitialGestureState();

    state = processGestureEvent(state, {
      type: "POINTER_DOWN",
      id: 1,
      x: 100,
      y: 200,
      time: 1000,
      currentZoom: 1.0,
    }).nextState;

    // Second pointer down
    const p2Res = processGestureEvent(state, {
      type: "POINTER_DOWN",
      id: 2,
      x: 200,
      y: 200, // initial distance = 100px
      time: 1020,
      currentZoom: 1.0,
    });
    state = p2Res.nextState;
    expect(p2Res.action.type).toBe("PINCH_START");
    expect(state.mode).toBe("pinching");

    // Move pointers further apart (pinch out to 200px distance)
    const moveRes = processGestureEvent(state, {
      type: "POINTER_MOVE",
      id: 2,
      x: 300,
      y: 200, // new distance = 200px
      time: 1060,
    });
    state = moveRes.nextState;
    expect(moveRes.action.type).toBe("PINCH_UPDATE");
    expect(moveRes.action.zoom).toBeCloseTo(2.0, 1);

    // Release pointers
    const p1Up = processGestureEvent(state, {
      type: "POINTER_UP",
      id: 1,
      x: 100,
      y: 200,
      time: 1100,
    });
    state = p1Up.nextState;
    expect(p1Up.action.type).toBe("PINCH_END");
    expect(state.mode).toBe("idle");
  });

  it("suppresses taps during the 300ms post-pinch cooldown", () => {
    let state = createInitialGestureState();

    // Perform pinch and release at time = 1000
    state = processGestureEvent(state, {
      type: "POINTER_DOWN",
      id: 1,
      x: 100,
      y: 100,
      time: 900,
      currentZoom: 1,
    }).nextState;
    state = processGestureEvent(state, {
      type: "POINTER_DOWN",
      id: 2,
      x: 200,
      y: 100,
      time: 910,
      currentZoom: 1,
    }).nextState;
    state = processGestureEvent(state, {
      type: "POINTER_UP",
      id: 2,
      x: 200,
      y: 100,
      time: 1000,
    }).nextState;

    // Quick tap attempted at time = 1150 (150ms after pinch end < 300ms cooldown)
    state = processGestureEvent(state, {
      type: "POINTER_DOWN",
      id: 1,
      x: 150,
      y: 150,
      time: 1150,
      currentZoom: 1,
    }).nextState;

    const tapRes = processGestureEvent(state, {
      type: "POINTER_UP",
      id: 1,
      x: 150,
      y: 150,
      time: 1200, // duration 50ms
    });

    // Tap must be ignored due to cooldown
    expect(tapRes.action.type).toBe("NONE");

    // Later tap at time = 1400 (400ms after pinch end > 300ms cooldown)
    state = processGestureEvent(state, {
      type: "POINTER_DOWN",
      id: 1,
      x: 150,
      y: 150,
      time: 1400,
      currentZoom: 1,
    }).nextState;

    const validTapRes = processGestureEvent(state, {
      type: "POINTER_UP",
      id: 1,
      x: 150,
      y: 150,
      time: 1450,
    });
    expect(validTapRes.action.type).toBe("TAP");
  });

  it("directly triggers slider drag when touching ring hit-box", () => {
    let state = createInitialGestureState();
    const isRingHit = (x: number, y: number) => x > 50 && x < 150 && y > 50 && y < 150;

    const res = processGestureEvent(
      state,
      {
        type: "POINTER_DOWN",
        id: 1,
        x: 100,
        y: 100,
        time: 1000,
        currentZoom: 1,
      },
      isRingHit
    );

    expect(res.action.type).toBe("SLIDER_DRAG_START");
    expect(res.nextState.mode).toBe("dragging-slider");
  });
});
