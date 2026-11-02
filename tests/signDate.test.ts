import { describe, expect, it } from "vitest";
import { readSignDateValue, signedToday } from "../src/domain/signDate";

describe("sign and date values", () => {
  it("captures the Singapore date when a signature is applied", () => {
    const value = signedToday("data:image/png;base64,signature", new Date("2026-10-29T16:30:00.000Z"));
    expect(readSignDateValue(value)).toEqual({ signature: "data:image/png;base64,signature", date: "2026-10-30" });
  });

  it("does not keep a date without a signature", () => {
    expect(readSignDateValue(signedToday("", new Date("2026-10-30T08:00:00.000Z")))).toEqual({ signature: "", date: "" });
  });
});
