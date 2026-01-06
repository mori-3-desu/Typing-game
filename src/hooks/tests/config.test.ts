import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfig } from '../useConfig';
import * as audioUtils from '../../utils/audio'; 

// 1. 音を鳴らす関数などをモック化（テスト中に実際の音を出さないため）
// ※パスが ../../utils/audio で合っているか確認してください
vi.mock('../../utils/audio', () => ({
  setSystemMute: vi.fn(),
  setVolumes: vi.fn(),
}));

describe('設定機能(useConfig)のテスト', () => {

  // 各テストの前に localStorage をきれいにする（前のテストの影響を受けないように）
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('一括ミュートをONにでき、システムに反映されること', () => {
    const { result } = renderHook(() => useConfig());

    // 初期値は false (音が出る状態)
    expect(result.current.isMuted).toBe(false);

    // ミュートにする操作
    act(() => {
      result.current.setIsMuted(true);
    });

    // Stateが true に変わったか確認
    expect(result.current.isMuted).toBe(true);
    
    // ★重要: 実際のオーディオ設定関数 (setSystemMute) が呼ばれたか？
    expect(audioUtils.setSystemMute).toHaveBeenCalledWith(true);
  });

  it('ローマ字表示をOFFに切り替えられること', () => {
    const { result } = renderHook(() => useConfig());

    // 初期値 true
    expect(result.current.showRomaji).toBe(true);

    // OFFにする
    act(() => {
      result.current.setShowRomaji(false);
    });

    // Stateが false になったか
    expect(result.current.showRomaji).toBe(false);
  });

  it('ブラウザを閉じても（再レンダリングしても）設定が保持されること', () => {
    // 1. ユーザーが初めてアクセス
    const { result, unmount } = renderHook(() => useConfig());

    // 設定を変更する（ミュートON）
    act(() => {
      result.current.setIsMuted(true);
    });
    
    // 確認: 今は true
    expect(result.current.isMuted).toBe(true);

    // 2. ブラウザを閉じる（コンポーネントを破棄）
    unmount();

    // 3. もう一度アクセス（再レンダリング）
    const { result: newResult } = renderHook(() => useConfig());

    // ★ここが大事！
    // 初期値の false ではなく、さっき保存した true が復元されているはず
    expect(newResult.current.isMuted).toBe(true);
  });
});