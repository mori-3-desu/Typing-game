import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTypingGame } from "../useTypingGame";
import { type WordDataMap } from "../../types";
import { GAUGE_CONFIG } from "../../utils/setting";

vi.mock("../../utils/audio", () => ({
  initAudio: vi.fn(),
  playSE: vi.fn(),
  playBGM: vi.fn(),
  stopBGM: vi.fn(),
  setVolumes: vi.fn(),
  setSystemMute: vi.fn(),
}));

type UseTypingGameReturn = ReturnType<typeof useTypingGame>;

const SAFE_CHAR_COUNT = 2000;
describe("ゲージのレベルアップ仕様のテスト", () => {
  const mockWordData: WordDataMap = {
    EASY: [{ jp: "あ".repeat(SAFE_CHAR_COUNT), roma: "a".repeat(SAFE_CHAR_COUNT) }],
    NORMAL: [],
    HARD: [],
  };

  // ヘルパー関数: 指定回数だけキー入力をシミュレートする
  const typeKeys = (
    result: { current: UseTypingGameReturn },
    count: number,
  ) => {
    act(() => {
      for (let i = 0; i < count; i++) {
        result.current.handleKeyInput("a");
      }
    });
  };

  it("ゲージが満タンになるとリセットされ、最大値が拡張される（上限設定あり）", () => {
    const { result } = renderHook(() => useTypingGame("EASY", mockWordData));
    const { INITIAL_MAX, INCREMENT, GAIN, CEILING } = GAUGE_CONFIG;

    act(() => result.current.startGame());

    // --- 1. 初回レベルアップ (150 -> 200) ---
    // 寸止めまで打つ
    const hitsToLevelUp1 = INITIAL_MAX / GAIN;
    typeKeys(result, hitsToLevelUp1 - 1);
    expect(result.current.gaugeValue).toBe(INITIAL_MAX - GAIN);

    // トドメ
    typeKeys(result, 1);
    expect(result.current.gaugeValue).toBe(0);
    expect(result.current.gaugeMax).toBe(INITIAL_MAX + INCREMENT);

    // --- 2. 複数回のレベルアップを経て上限(CEILING)に到達させる ---
    // 現在のMaxからCEILINGに達するまでループで回すことも可能ですが、
    // テストの明示性のために一気に上限手前までシミュレートします
    let currentMax = result.current.gaugeMax;
    while (currentMax < CEILING) {
      const hits = currentMax / GAIN;
      typeKeys(result, hits); // 満タンにしてレベルアップさせる
      currentMax = result.current.gaugeMax;
    }

    // 検証: 上限に達していること
    expect(result.current.gaugeMax).toBe(CEILING);

    // --- 3. 上限到達後の挙動確認 (300 -> 300のまま) ---
    const hitsAtCeiling = CEILING / GAIN;

    // 上限状態で満タンにする
    typeKeys(result, hitsAtCeiling);

    // 検証: ゲージはリセットされるが、MaxはCEILING(300)を維持
    expect(result.current.gaugeValue).toBe(0);
    expect(result.current.gaugeMax).toBe(CEILING);
  });
});
