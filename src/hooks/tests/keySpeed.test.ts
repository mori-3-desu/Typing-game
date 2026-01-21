import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTypingGame } from "../useTypingGame";
import { type WordDataMap } from "../../types";

// モック類
vi.mock("../../utils/audio", () => ({
  playTypeSound: vi.fn(),
  playMissSound: vi.fn(),
  playCorrectSound: vi.fn(),
  playGaugeSound: vi.fn(),
  playComboSound: vi.fn(),
  playBsSound: vi.fn(),
}));

vi.mock("../../utils/setting", async (importOriginal) => {
  // 1. 本物のファイルを全部持ってくる
  const actual = await importOriginal<typeof import("../../utils/setting")>();

  return {
    // 2. 本物の定数（GAUGE_CONFIG, SCORE_CONFIGなど全部）をここに展開！
    // 書かなくていいんです。ここに全部入ってます。
    ...actual,

    // 3. 上書きしたい「難易度設定」だけ手動で書く
    DIFFICULTY_SETTINGS: {
      EASY: { time: 60, bgm: "dummy" },
      NORMAL: { time: 45, bgm: "dummy" },
      HARD: { time: 30, bgm: "dummy" },
    },
  };
});

describe("入力速度(Speed)の計算テスト", () => {
  const mockData: WordDataMap = {
    EASY: [{ jp: "テスト", roma: "test" }],
    NORMAL: [],
    HARD: [],
  };

  it("MissやBackspaceが混ざっても、速度計算には影響しないこと", () => {
    const { result } = renderHook(() => useTypingGame("EASY", mockData));

    act(() => {
      result.current.startGame();
    });

    // 経過時間を 1.0秒 に強制設定
    act(() => {
      result.current.tick(1.0);
    });

    // 1. 正解打鍵 (t) -> correctCount: 1
    act(() => result.current.handleKeyInput("t"));

    // 2. ミス打鍵 (x) -> missCount: 1 (速度計算の分子には含まれない)
    act(() => result.current.handleKeyInput("x"));

    // 3. BS打鍵 -> backspaceCount: 1 (速度計算には含まれない)
    act(() => result.current.handleBackspace());

    // 計算式: correctCount(1) / elapsedTime(1.0) = 1.00 key/s
    expect(result.current.currentSpeed).toBe("1.00");
  });
});
