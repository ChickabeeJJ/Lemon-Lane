import { describe, expect, it } from "vitest";
import { formatDuration, formatNumber } from "../src/ui/format";

describe("formatNumber", () => {
  it.each([
    [0, "0"],
    [7.5, "7.5"],
    [999, "999"],
    [1000, "1K"],
    [1234, "1.23K"],
    [999_999, "999K"],
    [12_345_678, "12.3M"],
    [1.5e12, "1.5T"],
    [Number.NaN, "0"],
    [Infinity, "0"],
  ])("%s → %s", (n, out) => expect(formatNumber(n)).toBe(out));

  it("stays readable for enormous numbers", () => {
    expect(formatNumber(1e60).length).toBeLessThan(10);
  });
});

describe("formatDuration", () => {
  it("formats hours, minutes and seconds", () => {
    expect(formatDuration(5)).toBe("5s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(7260)).toBe("2h 1m");
  });
});
