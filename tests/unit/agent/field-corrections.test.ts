import { describe, expect, it } from "vitest";

import { permitsAgentFieldChange } from "@/lib/agent/field-corrections";

describe("agent field correction policy", () => {
  it("allows initial values and unchanged values", () => {
    expect(
      permitsAgentFieldChange(null, "Douala", "customer_message", "Douala"),
    ).toBe(true);
    expect(
      permitsAgentFieldChange("Douala", "Douala", "customer_message", "Douala"),
    ).toBe(true);
  });

  it("rejects silent overwrite and an unsupported correction label", () => {
    expect(
      permitsAgentFieldChange(
        "Douala",
        "Yaounde",
        "customer_message",
        "The location is Yaounde",
      ),
    ).toBe(false);
    expect(
      permitsAgentFieldChange(
        "Douala",
        "Yaounde",
        "explicit_correction",
        "The location is Yaounde",
      ),
    ).toBe(false);
  });

  it("allows a labeled correction supported by the current customer message", () => {
    expect(
      permitsAgentFieldChange(
        "Douala",
        "Yaounde",
        "explicit_correction",
        "Correction: change the location to Yaounde",
      ),
    ).toBe(true);
  });
});
