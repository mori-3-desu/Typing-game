import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingGame, type WordDataMap } from '../useTypingGame';

// 1. 音声を無効化
vi.mock('../../utils/audio', () => ({
  playTypeSound: vi.fn(),
  playMissSound: vi.fn(),
  playCorrectSound: vi.fn(),
  playGaugeSound: vi.fn(),
  playComboSound: vi.fn(),
  playBsSound: vi.fn(),
}));

// 2. 設定のモック
vi.mock('../../utils/setting', () => ({
  DIFFICULTY_SETTINGS: {
    EASY:   { time: 60, bgm: 'dummy' },
    NORMAL: { time: 45, bgm: 'dummy' },
    HARD:   { time: 30, bgm: 'dummy' }
  }
}));

// ★変更点: ファイルのモック(vi.mock('../data/words'))はもう不要なので削除！

describe('ゲームルールと難易度のテスト', () => {

  // ★テスト用のダミーデータを作成
  // 以前の「モック」の代わりに、これを引数として渡します
  const mockWordData: WordDataMap = {
    EASY:   [{ jp: 'あ'.repeat(30), roma: 'a'.repeat(30) }], // 長い単語（ゲージテスト用）
    NORMAL: [{ jp: 'テスト', roma: 'test' }],
    HARD:   [{ jp: 'テスト', roma: 'test' }]
  };

  describe('難易度ごとの初期設定', () => {
    it('EASYを選択すると制限時間が60秒になる', () => {
      // ★引数に mockWordData を渡す
      const { result } = renderHook(() => useTypingGame('EASY', mockWordData));
      expect(result.current.timeLeft).toBe(60);
    });

    it('HARDを選択すると制限時間が30秒になる', () => {
      const { result } = renderHook(() => useTypingGame('HARD', mockWordData));
      expect(result.current.timeLeft).toBe(30);
    });
  });

  describe('コンボとゲージの増減', () => {
    it('正解するとコンボが増え、ミスすると0にリセットされる', () => {
      const { result } = renderHook(() => useTypingGame('EASY', mockWordData));
      act(() => result.current.startGame());

      // 1回正解 -> コンボ 1
      act(() => {
        result.current.handleKeyInput('a');
      });
      expect(result.current.combo).toBe(1);

      // わざとミス -> コンボ 0
      act(() => {
        result.current.handleKeyInput('z');
      });
      expect(result.current.combo).toBe(0);
    });

    it('正解でゲージが+1され、ミスで-20（下限0）されること', () => {
      const { result } = renderHook(() => useTypingGame('EASY', mockWordData));
      act(() => result.current.startGame());

      // 1. 30回正解ループ（mockWordDataは30文字あるので単語は変わらない）
      for (let i = 0; i < 30; i++) {
        act(() => {
          result.current.handleKeyInput('a');
        });
      }
      
      // 確認: 30回正解したので 30 になっているはず
      expect(result.current.gaugeValue).toBe(30);

      // 2. わざとミスをする ('z') -> ここで -20 されるはず！
      act(() => {
        result.current.handleKeyInput('z');
      });

      // 検証: 30 - 20 = 10
      expect(result.current.gaugeValue).toBe(10);

      // 3. もう一度ミスをする -> 10 - 20 = -10 ではなく 0 で止まるか？
      act(() => {
        result.current.handleKeyInput('z');
      });

      // 検証: 下限は0
      expect(result.current.gaugeValue).toBe(0);
    });
  });
});