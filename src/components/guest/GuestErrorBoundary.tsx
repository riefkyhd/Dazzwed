"use client";

import React, { Component, type ReactNode } from "react";
import { reportClientEvent } from "@/lib/telemetry";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  eventSlug?: string;
  guestId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GuestErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("GuestErrorBoundary caught an error:", error, errorInfo);
    reportClientEvent({
      type: "error",
      message: `Boundary: ${error.message || String(error)}`,
      route: typeof window !== "undefined" ? window.location.pathname : "/e",
      eventSlug: this.props.eventSlug,
      guestId: this.props.guestId,
    });
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black text-white text-center font-sans select-none">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
          </div>

          <h1 className="text-xl font-bold font-serif mb-2 text-zinc-100">
            {this.props.fallbackTitle || "Something went wrong"}
          </h1>

          <p className="text-sm text-zinc-400 max-w-sm mb-6 leading-relaxed">
            Don&apos;t worry! Any photos you already took are safely stored on your device and will continue saving.
          </p>

          <button
            type="button"
            onClick={this.handleRestart}
            className="w-full max-w-xs py-3.5 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm tracking-wide shadow-lg shadow-amber-400/20 active:scale-95 transition-all cursor-pointer"
          >
            Restart Camera
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
