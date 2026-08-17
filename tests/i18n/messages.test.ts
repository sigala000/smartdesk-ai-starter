import { describe, expect, it } from "vitest";

import { messages, resolveLocale } from "@/lib/i18n/messages";

describe("localization foundation", () => {
  it("keeps English and French message shapes in parity", () => {
    expect(Object.keys(messages.fr)).toEqual(Object.keys(messages.en));
    expect(Object.keys(messages.fr.actions)).toEqual(
      Object.keys(messages.en.actions),
    );
    expect(Object.keys(messages.fr.fields)).toEqual(
      Object.keys(messages.en.fields),
    );
  });

  it("falls back safely to English", () => {
    expect(resolveLocale("fr")).toBe("fr");
    expect(resolveLocale("de")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });
});
