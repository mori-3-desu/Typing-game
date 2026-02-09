import { useEffect, useRef, type MutableRefObject } from "react";
import { DIFFICULTY_SETTINGS } from "../utils/setting";
import { playSE, playBGM } from "../utils/audio";
import {
  type GameState,
  type PlayPhase,
  type DifficultyLevel,
  type GameResultStats,
} from "../types";

// ■ 無視するキーのリスト
// ShiftやControlなどの修飾キー単体での入力を無視します
const IGNORED_KEYS = new Set([
  "Shift",
  "Alt",
  "Meta",
  "Control",
  "CapsLock",
  "Insert",
  "Delete",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

// ■ ブラウザのデフォルト動作を「常に」防ぐべきキー
// Spaceキーでのページスクロールなどを防ぎ、ゲームのような操作感を実現します
const PREVENT_DEFAULT_KEYS = new Set([
  " ",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

type UseGameKeyHandlerProps = {
  gameState: GameState;
  playPhase: PlayPhase;
  difficulty: DifficultyLevel;
  handleKeyInputRef: MutableRefObject<(key: string) => void>;
  handleBackspaceRef: MutableRefObject<() => void>;
  startGame: () => void;
  setPlayPhase: (phase: PlayPhase) => void;
  backToDifficulty: () => void;
  resetToReady: () => void;
  retryGame: () => void;
  lastGameStats: GameResultStats | null;
  rank: string;
  resultAnimStep: number;
  skipAnimation: (rank: string, isSound?: boolean) => void;
};

export const useGameKeyHandler = (props: UseGameKeyHandlerProps) => {
  // ---------------------------------------------------------------
  // ★ Latest Ref Pattern (不感時間ゼロの実現)
  // ---------------------------------------------------------------
  // useEffectの依存配列を空([])にするため、
  // 常に最新の props をこの ref に同期させます。
  // これにより、画面更新のたびにイベントリスナーが着脱されるのを防ぎます。
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  // ---------------------------------------------------------------
  // ★ 各種制御用フラグ (Reactの再レンダリングに依存しない変数)
  // ---------------------------------------------------------------

  // Ready画面で「Enter」を連打された時に、ゲーム開始処理が重複しないようにする鍵
  const isStartingRef = useRef(false);

  // リザルト画面で「スキップ」した直後の誤操作（リトライ等）を防ぐためのクールダウン
  const isResultSkipCoolDownRef = useRef(false);

  // IME（日本語入力）中かどうかを厳密に管理するフラグ
  const isComposingRef = useRef(false);

  useEffect(() => {
    // タイマーID保管用（クリーンアップで消せるようにしておく）
    let startTimerId: number | undefined;

    // -------------------------------------------------------------
    // IME (日本語入力) 監視イベント
    // -------------------------------------------------------------
    const handleCompositionStart = () => {
      isComposingRef.current = true; // 入力開始
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false; // 変換確定
    };

    // -------------------------------------------------------------
    // メインのキー入力ハンドラ
    // -------------------------------------------------------------
    const handleKeyDown = (e: KeyboardEvent) => {
      // 最新の props を Ref から取り出す（これで常に最新状態にアクセス可能）
      const {
        gameState,
        playPhase,
        difficulty,
        handleKeyInputRef,
        handleBackspaceRef,
        startGame,
        setPlayPhase,
        backToDifficulty,
        resetToReady,
        retryGame,
        lastGameStats,
        rank,
        resultAnimStep,
        skipAnimation,
      } = propsRef.current;

      // ▼ 1. Tabキー封じ（URLバーなどにフォーカスが移るのを防ぐ）
      if (e.key === "Tab") {
        e.preventDefault();
        return;
      }

      // ▼ 2. スクロール防止（Spaceキー等で画面が動かないようにする）
      if (PREVENT_DEFAULT_KEYS.has(e.key)) {
        e.preventDefault();
      }

      // ▼ 3. 無視キー判定（Shiftキーなどを弾く）
      if (e.key !== "Escape") {
        if (
          IGNORED_KEYS.has(e.key) ||
          (e.key.startsWith("F") && e.key.length > 1)
        ) {
          return;
        }
      }

      // ▼ 4. IME完全対策（日本語入力中のEnterなどは無視する）
      // isComposingRef (イベント由来) と e.isComposing (ブラウザ由来) の両方でチェック
      if (isComposingRef.current || e.isComposing || e.keyCode === 229) {
        return;
      }

      // -----------------------------------------------------------
      // State Machine: ゲームの状態ごとの分岐処理
      // -----------------------------------------------------------
      switch (gameState) {
        case "playing":
          // ■ Ready画面（ゲーム開始前）
          if (playPhase === "ready") {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();

              // ★ 連打防止: 既に開始処理中なら何もしない
              if (isStartingRef.current) return;
              isStartingRef.current = true; // 鍵をかける

              playSE("start");
              setPlayPhase("go");

              // 1秒後にゲーム開始
              startTimerId = window.setTimeout(() => {
                setPlayPhase("game");
                startGame();
                playBGM(DIFFICULTY_SETTINGS[difficulty].bgm);
                // 処理が終わったら鍵を開ける（念のため）
                isStartingRef.current = false;
              }, 1000);
            } else if (e.key === "Escape") {
              e.preventDefault();
              // タイマーが動いていたらキャンセル（ゾンビタイマー防止）
              if (startTimerId) clearTimeout(startTimerId);
              isStartingRef.current = false; // 鍵を強制解除
              backToDifficulty();
            }
            return;
          }

          // ■ Gameプレイ中
          if (playPhase === "game") {
            // ゲーム操作キーのブラウザ挙動停止
            if (e.key === "Backspace" || e.key === "Enter") {
              e.preventDefault();
            }

            if (e.key === "Escape") {
              e.preventDefault();
              resetToReady(); // 中断
              return;
            }
            if (e.key === "Backspace") {
              handleBackspaceRef.current(); // 文字削除
              return;
            }

            // 単一文字入力（a-zなど）のみ通す
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              handleKeyInputRef.current(e.key.toLowerCase());
            }
            return;
          }
          break;

        case "result": {
          // ■ リザルト画面
          const currentRank = lastGameStats ? lastGameStats.rank : rank;

          if (e.key === "Enter" || e.key === "Escape") {
            e.preventDefault();

            // ★ アニメーション途中ならスキップして即return
            // これにより、同じキー入力で「スキップ」と「遷移」が同時に起きるのを防ぐ
            if (resultAnimStep < 5) {
              skipAnimation(currentRank);

              // スキップ直後に誤操作しないよう、0.5秒の不感時間を設ける
              isResultSkipCoolDownRef.current = true;
              setTimeout(() => {
                isResultSkipCoolDownRef.current = false;
              }, 500);
              return;
            }

            // アニメ終了後、かつクールダウン明けなら遷移処理へ
            if (!isResultSkipCoolDownRef.current) {
              if (e.key === "Enter") {
                retryGame(); // リトライ
              } else {
                backToDifficulty(); // 戻る
              }
            }
          }
          break;
        }
        default:
          break;
      }
    };

    // -------------------------------------------------------------
    // イベントリスナーの登録
    // -------------------------------------------------------------
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("compositionstart", handleCompositionStart, true);
    window.addEventListener("compositionend", handleCompositionEnd, true);

    // -------------------------------------------------------------
    // クリーンアップ（コンポーネントが消える時に実行）
    // -------------------------------------------------------------
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener(
        "compositionstart",
        handleCompositionStart,
        true,
      );
      window.removeEventListener("compositionend", handleCompositionEnd, true);

      // ★ 最後の守り：画面遷移時にタイマーやフラグを確実にリセットする
      if (startTimerId) clearTimeout(startTimerId);
      isStartingRef.current = false;
    };
  }, []); // 依存配列は空！(Latest Ref Patternのおかげ)
};
