import { describe, expect, it } from "vitest";
import { createI18n, supportedLocales } from "../../src/i18n.js";

describe("createI18n", () => {
  it("translates known keys", () => {
    const { t } = createI18n("en");
    expect(t("reminderAdded")).toBe("Reminder added");
  });

  it("interpolates parameters", () => {
    const { t } = createI18n("en");
    expect(t("reminderDue", { title: "Water plants" })).toBe(
      "Reminder: Water plants",
    );
  });

  it("falls back to en for missing locales and keys", () => {
    const { t } = createI18n("xx");
    expect(t("reminderAdded")).toBe("Reminder added");
    expect(t("nope")).toBe("nope");
  });

  it("uses the fr catalog when requested", () => {
    const { t } = createI18n("fr");
    expect(t("reminderAdded")).toBe("Rappel ajouté");
  });

  it("exposes supported locales", () => {
    expect(supportedLocales()).toContain("en");
    expect(supportedLocales()).toContain("fr");
  });
});
