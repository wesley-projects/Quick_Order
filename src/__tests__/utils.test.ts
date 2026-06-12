import { formatCurrency, slugify, cn } from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats whole dollars", () => {
    expect(formatCurrency(10)).toBe("$10.00");
  });

  it("formats cents correctly", () => {
    expect(formatCurrency(1.99)).toBe("$1.99");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats large amounts", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });
});

describe("slugify", () => {
  it("converts spaces to hyphens", () => {
    expect(slugify("Mario's Pizza")).toBe("mario-s-pizza");
  });

  it("lowercases", () => {
    expect(slugify("Burger Barn")).toBe("burger-barn");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("-test-")).toBe("test");
  });

  it("collapses multiple spaces", () => {
    expect(slugify("Taco  Fiesta")).toBe("taco-fiesta");
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("deduplicates tailwind conflicts", () => {
    expect(cn("p-4", "p-6")).toBe("p-6");
  });
});
