import { describe, expect, it } from "vitest";
import { calculateBackoff, sleep } from "../src/backoff.js";

describe("calculateBackoff", () => {
  it("doubles the base delay on each retry", () => {
    expect(calculateBackoff(0, 1_000, 60_000)).toBe(1_000);
    expect(calculateBackoff(1, 1_000, 60_000)).toBe(2_000);
    expect(calculateBackoff(2, 1_000, 60_000)).toBe(4_000);
  });

  it("caps the delay at maxBackoffMs", () => {
    expect(calculateBackoff(6, 1_000, 60_000)).toBe(60_000);
    expect(calculateBackoff(10, 1_000, 60_000)).toBe(60_000);
  });

  it("respects a custom base and max", () => {
    expect(calculateBackoff(0, 500, 8_000)).toBe(500);
    expect(calculateBackoff(4, 500, 8_000)).toBe(8_000); // 500*16 = 8000
  });

  it("is deterministic (pure function)", () => {
    expect(calculateBackoff(3, 100, 10_000)).toBe(800);
  });
});

describe("sleep", () => {
  it("resolves after the given delay", async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});
