import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeNeighborIndices,
  classifySwipeGesture,
  resolveActiveFileId,
  applyScrollLock,
} from "@/components/admin/AdminPhotoLightbox";

describe("AdminPhotoLightbox Pure State & Gesture Engine", () => {
  describe("computeNeighborIndices", () => {
    it("loops cleanly at the beginning of the photo list", () => {
      const { prevIndex, nextIndex } = computeNeighborIndices(0, 10);
      expect(prevIndex).toBe(9); // Wraps to last photo
      expect(nextIndex).toBe(1);
    });

    it("loops cleanly at the end of the photo list", () => {
      const { prevIndex, nextIndex } = computeNeighborIndices(9, 10);
      expect(prevIndex).toBe(8);
      expect(nextIndex).toBe(0); // Wraps to first photo
    });

    it("handles intermediate photo indices", () => {
      const { prevIndex, nextIndex } = computeNeighborIndices(4, 10);
      expect(prevIndex).toBe(3);
      expect(nextIndex).toBe(5);
    });

    it("handles single-photo arrays without crashing or out-of-bounds", () => {
      const { prevIndex, nextIndex } = computeNeighborIndices(0, 1);
      expect(prevIndex).toBe(0);
      expect(nextIndex).toBe(0);
    });
  });

  describe("classifySwipeGesture", () => {
    it("classifies horizontal swipe left as 'next' photo navigation", () => {
      const gesture = classifySwipeGesture(200, 300, 140, 305); // deltaX = -60, deltaY = 5
      expect(gesture).toBe("next");
    });

    it("classifies horizontal swipe right as 'prev' photo navigation", () => {
      const gesture = classifySwipeGesture(100, 300, 160, 295); // deltaX = +60, deltaY = -5
      expect(gesture).toBe("prev");
    });

    it("classifies downward swipe as 'dismiss' modal action", () => {
      const gesture = classifySwipeGesture(200, 100, 205, 220); // deltaX = 5, deltaY = +120
      expect(gesture).toBe("dismiss");
    });

    it("ignores sub-threshold movements (below 45px horizontal or 90px vertical)", () => {
      const smallHorizontal = classifySwipeGesture(200, 300, 170, 300); // deltaX = -30
      expect(smallHorizontal).toBe("none");

      const smallVertical = classifySwipeGesture(200, 100, 200, 160); // deltaY = +60
      expect(smallVertical).toBe("none");
    });

    it("ignores diagonal gestures where horizontal and vertical are ambiguous", () => {
      const diagonal = classifySwipeGesture(100, 100, 150, 155); // absX = 50, absY = 55 (absY > absX, but deltaY < 90)
      expect(diagonal).toBe("none");
    });
  });

  describe("resolveActiveFileId", () => {
    const photoWithRaw = {
      drive_file_id: "graded-drive-id-123",
      original_drive_file_id: "raw-drive-id-456",
    };

    const photoWithoutRaw = {
      drive_file_id: "graded-drive-id-789",
      original_drive_file_id: null,
    };

    it("returns graded drive_file_id in 'filtered' mode", () => {
      expect(resolveActiveFileId(photoWithRaw, "filtered")).toBe("graded-drive-id-123");
      expect(resolveActiveFileId(photoWithoutRaw, "filtered")).toBe("graded-drive-id-789");
    });

    it("returns original_drive_file_id in 'original' mode when available", () => {
      expect(resolveActiveFileId(photoWithRaw, "original")).toBe("raw-drive-id-456");
    });

    it("falls back to drive_file_id in 'original' mode when original is null", () => {
      expect(resolveActiveFileId(photoWithoutRaw, "original")).toBe("graded-drive-id-789");
    });

    it("returns null when photo is undefined or null", () => {
      expect(resolveActiveFileId(null, "filtered")).toBeNull();
      expect(resolveActiveFileId(undefined, "original")).toBeNull();
    });
  });

  describe("DOM Scroll Lock Contract", () => {
    it("locks overflow on documentElement and body and restores original values on cleanup", () => {
      const mockDoc = {
        documentElement: { style: { overflow: "visible" } },
        body: { style: { overflow: "auto" } },
      };
      const mockWin = {
        scrollY: 450,
        scrollTo: vi.fn(),
      };

      const cleanup = applyScrollLock(mockDoc, mockWin);

      expect(mockDoc.documentElement.style.overflow).toBe("hidden");
      expect(mockDoc.body.style.overflow).toBe("hidden");

      cleanup();

      expect(mockDoc.documentElement.style.overflow).toBe("visible");
      expect(mockDoc.body.style.overflow).toBe("auto");
      expect(mockWin.scrollTo).toHaveBeenCalledWith(0, 450);
    });
  });
});
