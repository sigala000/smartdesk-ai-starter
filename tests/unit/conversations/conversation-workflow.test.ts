import { describe, expect, it } from "vitest";

import {
  applyAction,
  isComplete,
  nextRequiredStage,
  normalizeCameroonPhone,
  openingMessage,
} from "@/lib/domain/conversation-workflow";
import type { PublicDraft } from "@/lib/dto/public-conversation-dto";

const draft = (values: Partial<PublicDraft> = {}): PublicDraft => ({
  intent: "request_quotation",
  requestType: "quotation",
  serviceId: null,
  serviceName: null,
  customerName: null,
  phone: null,
  phoneConfirmedAt: null,
  email: undefined,
  description: null,
  location: null,
  preferredStartDate: undefined,
  budgetMin: undefined,
  budgetMax: undefined,
  stage: "choose_service",
  version: 1,
  ...values,
});

describe("deterministic public conversation workflow", () => {
  it("identifies itself and starts quotation collection with service", () => {
    expect(openingMessage).toContain("virtual assistant");
    expect(applyAction("request_quotation")).toMatchObject({
      values: { requestType: "quotation", stage: "choose_service" },
    });
  });

  it("asks required fields one at a time before optional fields", () => {
    expect(nextRequiredStage(draft())).toBe("choose_service");
    expect(nextRequiredStage(draft({ serviceId: "service" }))).toBe(
      "collect_name",
    );
    expect(
      nextRequiredStage(draft({ serviceId: "service", customerName: "Jane" })),
    ).toBe("collect_phone");
    expect(
      nextRequiredStage(
        draft({
          serviceId: "service",
          customerName: "Jane",
          phone: "+237612345678",
          phoneConfirmedAt: "now",
          description: "Renovate kitchen",
          location: "Douala",
        }),
      ),
    ).toBe("collect_email");
  });

  it("requires confirmed server draft values", () => {
    expect(isComplete(draft())).toBe(false);
    expect(
      isComplete(
        draft({
          serviceId: "service",
          customerName: "Jane",
          phone: "+237612345678",
          phoneConfirmedAt: "now",
          description: "Renovate kitchen",
          location: "Douala",
        }),
      ),
    ).toBe(true);
  });

  it("normalizes supported Cameroon mobile formats", () => {
    expect(normalizeCameroonPhone("6 12 34 56 78")).toBe("+237612345678");
    expect(normalizeCameroonPhone("237612345678")).toBe("+237612345678");
    expect(normalizeCameroonPhone("123")).toBeNull();
  });

  it("does not fabricate status or human handoff behavior", () => {
    expect(applyAction("check_request_status").reply).toContain(
      "secure request status page",
    );
    expect(applyAction("speak_to_employee").reply).toContain("cannot claim");
  });
});
