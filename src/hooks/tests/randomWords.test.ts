import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTypingGame } from "../useTypingGame";
import { type WordDataMap } from "../../types";

// 1. 新しい audio.ts の仕様に合わせてモックも更新！
vi.mock("../../utils/audio", () => ({
  // 初期化
  initAudio: vi.fn(),
  // 統合された再生関数
  playSE: vi.fn(),
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

describe("ゲームルールと難易度のテスト", () => {
  // テスト用データ
  const mockWordData: WordDataMap = {
    EASY: [{ jp: "あ".repeat(30), roma: "a".repeat(30) }], // 長い単語
    NORMAL: [{ jp: "テスト", roma: "test" }],
    HARD: [{ jp: "テスト", roma: "test" }],
  };

  describe("難易度ごとの初期設定", () => {
    it("EASYを選択すると制限時間が60秒になる", () => {
      const { result } = renderHook(() => useTypingGame("EASY", mockWordData));
      expect(result.current.timeLeft).toBe(60);
    });

    it("HARDを選択すると制限時間が30秒になる", () => {
      const { result } = renderHook(() => useTypingGame("HARD", mockWordData));
      expect(result.current.timeLeft).toBe(30);
    });
  });

  describe("コンボとゲージの増減", () => {
    it("正解するとコンボが増え、ミスすると0にリセットされる", () => {
      const { result } = renderHook(() => useTypingGame("EASY", mockWordData));
      act(() => result.current.startGame());

      // 正解
      act(() => result.current.handleKeyInput("a"));
      expect(result.current.combo).toBe(1);

      // ミス
      act(() => result.current.handleKeyInput("z"));
      expect(result.current.combo).toBe(0);
    });

    it("正解でゲージが+1され、ミスで-20（下限0）されること", () => {
      const { result } = renderHook(() => useTypingGame("EASY", mockWordData));
      act(() => result.current.startGame());

      // 30回正解ループ
      for (let i = 0; i < 30; i++) {
        act(() => result.current.handleKeyInput("a"));
      }
      expect(result.current.gaugeValue).toBe(30);

      // ミス (-20)
      act(() => result.current.handleKeyInput("z"));
      expect(result.current.gaugeValue).toBe(10);

      // さらにミス (下限0)
      act(() => result.current.handleKeyInput("z"));
      expect(result.current.gaugeValue).toBe(0);
    });
  });
});
