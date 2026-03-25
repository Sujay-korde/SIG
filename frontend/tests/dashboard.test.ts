import { describe, expect, it } from "vitest";

import { defaultSnapshot, formatMetric, shouldShowApprovalModal } from "../lib/dashboard";

describe("dashboard helpers", () => {
  it("shows approval modal when confidence is below threshold", () => {
    expect(shouldShowApprovalModal(defaultSnapshot)).toBe(true);
  });

  it("formats queue metrics with compact notation", () => {
    expect(formatMetric("notif_queue_depth", 1200)).toBe("1.2k");
  });
});
