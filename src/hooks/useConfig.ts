/**
 * @file useConfig.ts
 * @description ゲーム設定（音量や表示オプション）を管理するカスタムフック
 *
 * 【アーキテクチャの特徴】
 * 1. Single Source of Truth: useReducerで状態を一元管理
 * 2. Type Safety: 独自の型ガード関数で、壊れたJSONや不正な型からアプリを保護
 * 3. Cross-Tab Sync: StorageEventを利用し、別タブでの設定変更をリアルタイム同期
 */
import { useCallback, useEffect, useReducer } from "react";
import { setSystemMute, setVolumes } from "../utils/audio";
import { STORAGE_KEYS, DEFAULT_CONFIG } from "../utils/setting";

// 定数の展開（可読性向上）
const { VOLUME_BGM, VOLUME_SE, VOLUME_MUTE, SHOW_ROMAJI } = STORAGE_KEYS;
const { VOLUME_BGM_SE, IS_MUTED, D_SHOW_ROMAJI } = DEFAULT_CONFIG;

// --- 1. 型定義 ---

type ConfigState = {
  isMuted: boolean;
  bgmVol: number;
  seVol: number;
  showRomaji: boolean;
};

// Discriminated Union (判別可能な共用体)
// typeフィールドでアクションを明確に区別し、Reducer内での型推論を効かせる
type ConfigAction =
  | { type: "MUTE"; payload: boolean }
  | { type: "BGM"; payload: number }
  | { type: "SE"; payload: number }
  | { type: "SHOWROMA"; payload: boolean }
  | { type: "SYNC_STORAGE"; payload: Partial<ConfigState> }; // 外部同期用

// --- 2. 安全性確保のためのヘルパー関数 ---

/**
 * 型ガード関数 (User-Defined Type Guard)
 * JavaScriptの typeof の弱点（配列やnullも 'object' と判定される問題）を克服する
 */
const isValidType = <T>(value: unknown, defaultValue: T): value is T => {
  // 配列チェック: defaultValueが配列ならvalueも配列である(オブジェクト✓なので今回はNG)
  if (Array.isArray(defaultValue)) return Array.isArray(value);

  // オブジェクトチェック: nullは 'object' になるため除外する
  if (typeof defaultValue === "object" && defaultValue !== null) {
    return (
      typeof value === "object" && value !== null && !Array.isArray(value) // 配列の混入も防ぐ
    );
  }

  // プリミティブ（number, boolean, string）はそのまま比較
  return typeof value === typeof defaultValue;
};

/**
 * 安全なストレージ取得関数 (Defense in Depth)
 * 4段階の防御壁でクラッシュを防ぐ
 */
const getSafeStorage = <T>(key: string, defaultValue: T): T => {
  // 防御1: SSR (Server Side Rendering) 環境での実行エラー防止
  if (typeof window === "undefined") return defaultValue;

  const saved = localStorage.getItem(key);

  // 防御2: 初回訪問時（データなし）のハンドリング
  if (saved === null) return defaultValue;

  try {
    const parsed = JSON.parse(saved);

    // 防御3: データ破損・型不一致（改竄やバグによる不正データ）の検知
    if (!isValidType(parsed, defaultValue)) {
      console.warn(`[Config] Invalid type for key: ${key}. Using default.`);
      return defaultValue;
    }
    return parsed;
  } catch {
    // 防御4: JSONパースエラー（保存データが壊れている場合）のハンドリング
    console.error(`[Config] Parse error for key: ${key}. Using default.`);
    return defaultValue;
  }
};

// --- 3. 初期状態の生成 ---

/**
 * 初期化関数 (Lazy Initialization)
 * useReducerの第三引数に渡すことで、初回レンダリング時のみ実行される
 * (重い処理を毎回走らせないためのパフォーマンス最適化)
 */
const createInitialState = (): ConfigState => {
  let initialMute = false;

  // URLパラメータ (?muted=true) を最優先で適用（LPからの遷移など）
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("muted") === "true") {
      initialMute = true;
    } else {
      // URL指定がない場合はストレージから読み込む
      initialMute = getSafeStorage(VOLUME_MUTE, IS_MUTED);
    }
  }

  return {
    isMuted: initialMute,
    bgmVol: getSafeStorage(VOLUME_BGM, VOLUME_BGM_SE),
    seVol: getSafeStorage(VOLUME_SE, VOLUME_BGM_SE),
    showRomaji: getSafeStorage(SHOW_ROMAJI, D_SHOW_ROMAJI),
  };
};

// --- 4. Reducer (状態更新ロジック) ---

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

// --- 5. Custom Hook 本体 ---

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

  // [Side Effect 2] localStorageへの保存
  // 状態が変わるたびに自動で永続化する
  useEffect(() => {
    localStorage.setItem(VOLUME_MUTE, JSON.stringify(state.isMuted));
    localStorage.setItem(VOLUME_BGM, JSON.stringify(state.bgmVol));
    localStorage.setItem(VOLUME_SE, JSON.stringify(state.seVol));
    localStorage.setItem(SHOW_ROMAJI, JSON.stringify(state.showRomaji));
  }, [state]);

  // [Side Effect 3] クロスタブ同期 (StorageEvent)
  // 別タブで設定が変更された時に検知して同期する
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // 自分のアプリに関係ないキーや、削除操作(newValue === null)は無視
      if (!e.newValue) return;

      try {
        // JSON.parse(null) は null を返すが、
        // JSON.parse("") (空文字) だと SyntaxError で即死する。
        // また、nullのまま後続の switch 文に行くと型チェックで落ちる可能性がある。
        // 上記のガードを採用
        const val = JSON.parse(e.newValue);

        // 変更されたキーに応じてアクションを発行
        switch (e.key) {
          case VOLUME_MUTE:
            if (isValidType(val, IS_MUTED)) {
              dispatch({ type: "SYNC_STORAGE", payload: { isMuted: val } });
            }
            break;
          case VOLUME_BGM:
            if (isValidType(val, VOLUME_BGM_SE)) {
              dispatch({ type: "SYNC_STORAGE", payload: { bgmVol: val } });
            }
            break;
          case VOLUME_SE:
            if (isValidType(val, VOLUME_BGM_SE)) {
              dispatch({ type: "SYNC_STORAGE", payload: { seVol: val } });
            }
            break;
          case SHOW_ROMAJI:
            if (isValidType(val, D_SHOW_ROMAJI)) {
              dispatch({ type: "SYNC_STORAGE", payload: { showRomaji: val } });
            }
            break;
        }
      } catch (err) {
        console.error("[Config] Storage sync failed", err);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    // クリーンアップ関数: コンポーネント破棄時にイベントリスナーを解除
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // [Actions] コンポーネントに提供する操作関数
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

  const setShowRomaji = useCallback(
    (payload: boolean) => dispatch({ type: "SHOWROMA", payload }),
    [],
  );

  return {
    ...state, // stateの中身 (isMuted, bgmVol...) を展開して返す
    setIsMuted,
    setBgmVol,
    setSeVol,
    setShowRomaji,
  };
};
