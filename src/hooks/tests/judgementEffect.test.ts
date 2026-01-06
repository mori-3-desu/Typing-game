import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingGame, type WordDataMap } from '../useTypingGame';

// Audioモック
vi.mock('../../utils/audio', () => ({
  playTypeSound: vi.fn(), playMissSound: vi.fn(), playCorrectSound: vi.fn(),
  playGaugeSound: vi.fn(), playComboSound: vi.fn(), playBsSound: vi.fn(),
}));

// Settingモック
vi.mock('../../utils/setting', () => ({
  DIFFICULTY_SETTINGS: {
    EASY: { time: 60, bgm: 'dummy' },
    NORMAL: { time: 60, bgm: 'dummy' },
    HARD: { time: 60, bgm: 'dummy' }
  }
}));

describe('キー判定テスト（データ固定版）', () => {

  // テスト用データ：必ず "test" が出るようにする
  const mockData: WordDataMap = {
    EASY: [{ jp: 'テスト', roma: 'test' }],
    NORMAL: [],
    HARD: []
  };

  it('正解キー(t)を打つと緑判定(OK/NEXT)になり、正解数が増える', () => {
    // 第2引数にデータを渡す
    const { result } = renderHook(() => useTypingGame('EASY', mockData));
    
    act(() => {
      result.current.startGame();
    });

    // 正解のキー 't' を打つ
    act(() => {
      result.current.handleKeyInput('t');
    });

    // 正解数が 1 になっているか
    expect(result.current.correctCount).toBe(1);
    
    // ログが緑色になっているか確認
    const log = result.current.romaState.typedLog;
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].char).toBe('t');
    expect(log[0].color).toBe('#4aff50'); // 緑色
  });

  it('不正解キー(x)を打つとミスになり、ミス数が増える', () => {
    const { result } = renderHook(() => useTypingGame('EASY', mockData));
    
    act(() => {
      result.current.startGame();
    });

    // 不正解のキー 'x' を打つ
    act(() => {
      result.current.handleKeyInput('x');
    });

    // ミス数が 1 になっているか
    expect(result.current.missCount).toBe(1);
    
    // 正解数は増えていないこと
    expect(result.current.correctCount).toBe(0);
  });
});