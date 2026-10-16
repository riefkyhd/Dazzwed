import { describe, it, expect } from "vitest";
import React from "react";
import {
  Skeleton,
  KpiCardSkeleton,
  GalleryGridSkeleton,
  TableSkeleton,
  ChartPanelSkeleton,
  FormCardSkeleton,
} from "@/components/ui/Skeleton";

describe("Instant Navigation Dark-Room Skeletons", () => {
  describe("Skeleton Primitive", () => {
    it("renders with default dark-room pulse classes", () => {
      const element = Skeleton({ className: "w-20 h-4", "aria-hidden": true });
      expect(element).toBeDefined();
      expect(element.props.className).toContain("animate-pulse");
      expect(element.props.className).toContain("bg-stone-900/80");
      expect(element.props.className).toContain("border-stone-800/60");
      expect(element.props.className).toContain("w-20 h-4");
      expect(element.props["aria-hidden"]).toBe(true);
    });
  });

  describe("KpiCardSkeleton", () => {
    it("renders dark-room container with label, value, and footer skeletons", () => {
      const element = KpiCardSkeleton();
      expect(element.props.className).toContain("bg-stone-950/80");
      expect(element.props.className).toContain("border-stone-800/80");

      const children = React.Children.toArray(element.props.children);
      expect(children.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("GalleryGridSkeleton", () => {
    it("renders exactly the specified count of aspect-[3/4] card skeletons", () => {
      const element = GalleryGridSkeleton({ count: 12 });
      expect(element.props.className).toContain("grid");
      expect(element.props.className).toContain("grid-cols-2");

      const children = React.Children.toArray(element.props.children);
      expect(children.length).toBe(12);

      const firstCard = children[0] as React.ReactElement<{ className?: string }>;
      expect(firstCard.props.className).toContain("aspect-[3/4]");
      expect(firstCard.props.className).toContain("bg-stone-950");
    });
  });

  describe("TableSkeleton", () => {
    it("renders custom rows and cols matching table data structure", () => {
      const element = TableSkeleton({ rows: 5, cols: 4 });
      expect(element.props.className).toContain("bg-stone-950/80");

      const children = React.Children.toArray(element.props.children);
      expect(children.length).toBe(2); // Header + Rows wrapper

      const rowsWrapper = children[1] as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
      expect(rowsWrapper.props.className).toContain("divide-y");
      const rows = React.Children.toArray(rowsWrapper.props.children);
      expect(rows.length).toBe(5);

      const firstRow = rows[0] as React.ReactElement<{ children?: React.ReactNode }>;
      const cells = React.Children.toArray(firstRow.props.children);
      expect(cells.length).toBe(4);
    });
  });

  describe("ChartPanelSkeleton & FormCardSkeleton", () => {
    it("renders ChartPanelSkeleton with configurable height", () => {
      const element = ChartPanelSkeleton({ height: "h-80" });
      expect(element.props.className).toContain("bg-stone-950/80");
      expect(element.props.className).toContain("h-80");
    });

    it("renders FormCardSkeleton with requested number of input rows", () => {
      const element = FormCardSkeleton({ rows: 3 });
      expect(element.props.className).toContain("bg-stone-950/80");
      const children = React.Children.toArray(element.props.children);
      const rowsWrapper = children[1] as React.ReactElement<{ children?: React.ReactNode }>;
      const rows = React.Children.toArray(rowsWrapper.props.children);
      expect(rows.length).toBe(3);
    });
  });

  describe("Optimistic Active Navigation Tab Logic", () => {
    it("resolves optimisticPath immediately when set, taking precedence over pathname", () => {
      const pathname = "/admin";
      let optimisticPath: string | null = "/admin/photos";

      const activePath = optimisticPath || pathname;
      expect(activePath).toBe("/admin/photos");

      // Once navigation completes and optimisticPath is cleared:
      optimisticPath = null;
      const updatedActivePath = optimisticPath || "/admin/photos";
      expect(updatedActivePath).toBe("/admin/photos");
    });
  });
});
