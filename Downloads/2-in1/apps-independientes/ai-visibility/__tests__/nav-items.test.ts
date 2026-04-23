import { describe, expect, it } from "vitest";
import { navItems } from "@/lib/nav-items";

describe("navigation items", () => {
  it("contains the required placeholders", () => {
    expect(navItems.map((item) => item.label)).toEqual([
      "Overview",
      "Prompts",
      "Responses",
      "Citations",
      "Competitors",
      "Tags",
      "Settings"
    ]);
  });
});
