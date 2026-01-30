import { describe, it, expect, vi } from "vitest";
import { calculateRank } from "../useTypingGame";

vi.mock("../../utils/audio", () => ({
  // audio.ts の中身をすべて空っぽの関数(vi.fn)に置き換える
  initAudio: vi.fn(),
  playSE: vi.fn(),
  playBGM: vi.fn(),
  stopBGM: vi.fn(),
  setVolumes: vi.fn(),
  setSystemMute: vi.fn(),
}));

describe("ランク判定ロジック (calculateRank)", () => {
  // EASYモードのテスト
  describe("EASY Mode", () => {
    const diff = "EASY";

    it("0点は Dランクであること", () => {
      expect(calculateRank(diff, 0)).toBe("D");
    });

    it("49,999点は Dランクであること (Cランク直前)", () => {
      expect(calculateRank(diff, 49999)).toBe("D");
    });

    it("50,000点は Cランクになること (境界値)", () => {
      expect(calculateRank(diff, 50000)).toBe("C");
    });

    it("125,000点は Bランクになること", () => {
      expect(calculateRank(diff, 125000)).toBe("B");
    });

    it("250,000点は Aランクになること", () => {
      expect(calculateRank(diff, 250000)).toBe("A");
    });

    it("499,999点は Aランクであること", () => {
      expect(calculateRank(diff, 499999)).toBe("A");
    });

    it("500,000点は Sランクになること", () => {
      expect(calculateRank(diff, 500000)).toBe("S");
    });
  });

  // NORMALモードのテスト
  describe("NORMAL Mode", () => {
    const diff = "NORMAL";

    it("149,999点は Dランクであること", () => {
      expect(calculateRank(diff, 149999)).toBe("D");
    });

    it("150,000点は Cランクであること", () => {
      expect(calculateRank(diff, 150000)).toBe("C");
    });

    it("899,999点は Aランクであること", () => {
      expect(calculateRank(diff, 899999)).toBe("A");
    });

    it("900,000点は Sランクであること", () => {
      expect(calculateRank(diff, 900000)).toBe("S");
    });
  });

  // HARDモードのテスト
  describe("HARD Mode", () => {
    const diff = "HARD";

    it("249,999点は Dランクであること", () => {
      expect(calculateRank(diff, 249999)).toBe("D");
    });

    it("250,000点は Cランクであること", () => {
      expect(calculateRank(diff, 250000)).toBe("C");
    });

    it("1,299,999点は Aランクであること", () => {
      expect(calculateRank(diff, 1299999)).toBe("A");
    });

    it("1,300,000点は Sランクであること", () => {
      expect(calculateRank(diff, 1300000)).toBe("S");
    });
  });
});
