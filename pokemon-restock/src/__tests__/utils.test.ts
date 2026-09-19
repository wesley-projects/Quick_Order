import { formatCurrency, isAtRetail, markupPercent, slugify, timeAgo } from "@/lib/utils";

describe("formatCurrency", () => {
  it("renders cents as dollars", () => {
    expect(formatCurrency(5999)).toBe("$59.99");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(16164)).toBe("$161.64");
  });

  it("renders a dash when there is no price", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
  });
});

describe("isAtRetail", () => {
  it("treats exactly MSRP as retail", () => {
    expect(isAtRetail(5999, 5999)).toBe(true);
  });

  it("accepts below MSRP and rejects a single cent over", () => {
    expect(isAtRetail(5499, 5999)).toBe(true);
    expect(isAtRetail(6000, 5999)).toBe(false);
  });

  it("is false when there is no price to judge", () => {
    expect(isAtRetail(null, 5999)).toBe(false);
  });
});

describe("markupPercent", () => {
  it("reports markup over MSRP", () => {
    expect(markupPercent(11998, 5999)).toBe(100);
    expect(markupPercent(5999, 5999)).toBe(0);
  });

  it("reports a discount as negative", () => {
    expect(markupPercent(4499, 5999)).toBe(-25);
  });

  it("returns null when it cannot be computed", () => {
    expect(markupPercent(null, 5999)).toBeNull();
    expect(markupPercent(5999, 0)).toBeNull();
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-01-10T12:00:00Z");

  it("describes recent times", () => {
    expect(timeAgo(new Date("2026-01-10T11:59:50Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-01-10T11:55:00Z"), now)).toBe("5m ago");
    expect(timeAgo(new Date("2026-01-10T09:00:00Z"), now)).toBe("3h ago");
    expect(timeAgo(new Date("2026-01-07T12:00:00Z"), now)).toBe("3d ago");
  });

  it("handles a missing date", () => {
    expect(timeAgo(null, now)).toBe("never");
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Scarlet & Violet—151 Elite Trainer Box")).toBe(
      "scarlet-violet151-elite-trainer-box",
    );
    expect(slugify("  Surging Sparks  ")).toBe("surging-sparks");
  });
});
