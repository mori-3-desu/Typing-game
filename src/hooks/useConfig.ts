/**
 * @file useConfig.ts
 * @description ゲーム設定（音量や表示オプション）を管理するカスタムフック
 *
 * 【アーキテクチャの特徴】
 * 1. Single Source of Truth: useReducerで状態を一元管理
 * 2. Type Safety: 型ガード関数で、壊れたJSONや不正な型からアプリを保護
 * 3. Cross-Tab Sync: StorageEventを利用し、別タブでの設定変更をリアルタイム同期
 */
import { useCallback, useEffect, useReducer } from "react";

import { storage } from "../services/storage";
import { setSystemMute, setVolumes } from "../utils/audio";
import { STORAGE_KEYS } from "../utils/constants";

type ConfigState = {
  isMuted: boolean;
  bgmVol: number;
  seVol: number;
  brightness: number;
  showRomaji: boolean;
};

type ConfigAction =
  | { type: "MUTE"; payload: boolean }
  | { type: "BGM"; payload: number }
  | { type: "SE"; payload: number }
  | { type: "SHOWROMA"; payload: boolean }
  | { type: "BRIGHTNESS"; payload: number } //
  | { type: "SYNC_STORAGE"; payload: Partial<ConfigState> }; // 外部同期用

const DEFAULT_CONFIG: ConfigState = {
  bgmVol: 0.5,
  seVol: 0.5,
  isMuted: false,
  brightness: 1,
  showRomaji: true,
};

const parseConfigState = (raw: string): ConfigState => {
  const data = JSON.parse(raw);
  if (typeof data?.bgmVol !== "number") throw new Error("invalid");
  return data as ConfigState;
};

/**
 * 初期化関数 (Lazy Initialization)
 * useReducerの第三引数に渡すことで、初回レンダリング時のみ実行される
 * (重い処理を毎回走らせないためのパフォーマンス最適化)
 */
const createInitialState = (): ConfigState => {
  const saved =
    storage.get<ConfigState>(STORAGE_KEYS.SETTINGS, parseConfigState) ??
    DEFAULT_CONFIG;

  // URLパラメータ (?muted=true) を最優先で適用（LPからの遷移など）
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("muted") === "true") {
      return { ...saved, isMuted: true };
    }
  }

  return saved;
};

const configReducer = (
  state: ConfigState,
  action: ConfigAction,
): ConfigState => {
  switch (action.type) {
    case "MUTE":
      return { ...state, isMuted: action.payload };
    case "BGM":
      return { ...state, bgmVol: action.payload };
    case "SE":
      return { ...state, seVol: action.payload };
    case "BRIGHTNESS":
      return { ...state, brightness: action.payload };
    case "SHOWROMA":
      return { ...state, showRomaji: action.payload };

    case "SYNC_STORAGE": {
      // 無限ループ防止（ピンポン現象対策）
      // 新しい値が現行Stateと完全に同じなら、更新をスキップして再レンダリングを防ぐ
      const payload = action.payload;

      // payloadに含まれるキーだけをループして、一つでも値が異なれば更新
      const hasActualChange = (
        Object.keys(payload) as Array<keyof ConfigState>
      ).some((key) => payload[key] !== state[key]);
      if (!hasActualChange) return state;

      return { ...state, ...payload };
    }
    default:
      // 想定外のアクションが来てもクラッシュさせず、現状維持する
      return state;
  }
};

export const useConfig = () => {
  const [state, dispatch] = useReducer(
    configReducer,
    undefined,
    createInitialState,
  );

  // [Side Effect 1] AudioEngineへの反映
  // Reactの状態(state)と、外部システム(Audioクラス)を同期させる
  useEffect(() => {
    setSystemMute(state.isMuted);
  }, [state.isMuted]);

  useEffect(() => {
    setVolumes(state.bgmVol, state.seVol);
  }, [state.bgmVol, state.seVol]);

  // 状態が変わるたびに自動で永続化する
  useEffect(() => {
    storage.setJSON(STORAGE_KEYS.SETTINGS, state);
  }, [state]);

  // クロスタブ同期: 別タブで設定が変更された時に検知して同期する
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // 自分のアプリに関係ないキーや、削除操作(newValue === null)は無視
      if (!e.newValue) return;

      if (e.key === STORAGE_KEYS.SETTINGS) {
        const settings = storage.get<ConfigState>(
          STORAGE_KEYS.SETTINGS,
          parseConfigState,
        );

        if (settings) {
          dispatch({ type: "SYNC_STORAGE", payload: settings });
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // useCallbackでメモ化し、子コンポーネントの不要な再レンダリングを防ぐ
  const setIsMuted = useCallback(
    (payload: boolean) => dispatch({ type: "MUTE", payload }),
    [],
  );

  const setBgmVol = useCallback(
    (payload: number) => dispatch({ type: "BGM", payload }),
    [],
  );

  const setSeVol = useCallback(
    (payload: number) => dispatch({ type: "SE", payload }),
    [],
  );

  const setBrightness = useCallback(
    (payload: number) => dispatch({ type: "BRIGHTNESS", payload }),
    [],
  );

  const setShowRomaji = useCallback(
    (payload: boolean) => dispatch({ type: "SHOWROMA", payload }),
    [],
  );

  return {
    ...state,
    setIsMuted,
    setBgmVol,
    setSeVol,
    setBrightness,
    setShowRomaji,
  };
};
