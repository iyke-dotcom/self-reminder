import { describe, expect, it } from "vitest";
import { GROUP_TYPES, templateFor } from "../../src/modules/groupTemplates.js";

describe("group role templates (one engine, many labels)", () => {
  it("covers every group type with distinct labels", () => {
    expect(GROUP_TYPES).toEqual([
      "solo",
      "pair",
      "study",
      "medical",
      "corporate",
      "custom",
    ]);
    for (const type of GROUP_TYPES) {
      const template = templateFor(type);
      expect(template.icon).toBeTruthy();
      expect(template.memberNoun).toBeTruthy();
      expect(template.eventNoun).toBeTruthy();
      expect(template.eventPlaceholder).toBeTruthy();
      expect(template.notePlaceholder).toBeTruthy();
    }
  });

  it("swaps labels for study, medical and corporate groups", () => {
    expect(templateFor("study").memberNoun).toMatch(/Teacher/);
    expect(templateFor("medical").memberNoun).toMatch(/Doctor/);
    expect(templateFor("corporate").memberNoun).toMatch(/Manager/);
    expect(templateFor("medical").noteExamples).toContain("Running late");
  });

  it("falls back to custom for unknown types", () => {
    expect(templateFor("nope")).toEqual(templateFor("custom"));
  });
});
