"use client";

import React from "react";

interface ViewfinderFrameProps {
  visible?: boolean;
}

/**
 * Viewfinder retro frame decoration:
 * Four corner brackets only, inset 12px, stroke 1.5px, 45% gold.
 * Placed inside the viewfinder component above the video/canvas and below user controls.
 * Hidden in full-bleed 16:9 mode and during aspect animation.
 */
export function ViewfinderFrame({ visible = true }: ViewfinderFrameProps) {
  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none z-10"
      aria-hidden="true"
    >
      {/* Top-Left Corner Bracket */}
      <div
        data-testid="corner-bracket-tl"
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          width: "16px",
          height: "16px",
          borderTop: "1.5px solid rgba(251, 191, 36, 0.45)",
          borderLeft: "1.5px solid rgba(251, 191, 36, 0.45)",
        }}
      />

      {/* Top-Right Corner Bracket */}
      <div
        data-testid="corner-bracket-tr"
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          width: "16px",
          height: "16px",
          borderTop: "1.5px solid rgba(251, 191, 36, 0.45)",
          borderRight: "1.5px solid rgba(251, 191, 36, 0.45)",
        }}
      />

      {/* Bottom-Left Corner Bracket */}
      <div
        data-testid="corner-bracket-bl"
        style={{
          position: "absolute",
          bottom: "12px",
          left: "12px",
          width: "16px",
          height: "16px",
          borderBottom: "1.5px solid rgba(251, 191, 36, 0.45)",
          borderLeft: "1.5px solid rgba(251, 191, 36, 0.45)",
        }}
      />

      {/* Bottom-Right Corner Bracket */}
      <div
        data-testid="corner-bracket-br"
        style={{
          position: "absolute",
          bottom: "12px",
          right: "12px",
          width: "16px",
          height: "16px",
          borderBottom: "1.5px solid rgba(251, 191, 36, 0.45)",
          borderRight: "1.5px solid rgba(251, 191, 36, 0.45)",
        }}
      />
    </div>
  );
}
