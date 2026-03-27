import { useEffect, useEffectEvent, useRef } from "react";

import {
  type DifficultyLevel,
  type GameResultStats,
  type GameState,
  type PlayPhase,
} from "../types";
import { playBGM, playSE } from "../utils/audio";
import { DIFFICULTY_SETTINGS } from "../utils/constants";

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
  handleKeyInput: (key: string) => void;
  handleBackspace: () => void;
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

export const useGameKeyHandler = ({
  gameState,
  playPhase,
  difficulty,
  handleKeyInput,
  handleBackspace,
  startGame,
  setPlayPhase,
  backToDifficulty,
  resetToReady,
  retryGame,
  lastGameStats,
  rank,
  resultAnimStep,
  skipAnimation,
}: UseGameKeyHandlerProps) => {
  // Ready画面で「Enter」を連打された時に、ゲーム開始処理が重複しないようにする鍵
  const isStartingRef = useRef(false);

  // リザルト画面で「スキップ」した直後の誤操作（リトライ等）を防ぐためのクールダウン
  const isResultSkipCoolDownRef = useRef(false);

  // IME（日本語入力）中かどうかを厳密に管理するフラグ
  const isComposingRef = useRef(false);

  // タイマーID保管用（クリーンアップで消せるようにuseRefで管理）
  const startTimerIdRef = useRef<number | undefined>(undefined);

  // -------------------------------------------------------------
  // Ready画面のキー処理
  // useEffectEvent: レンダーごとに最新の props を自動でキャプチャする
  // (Latest Ref Pattern の手動同期が不要になる)
  // -------------------------------------------------------------
  const handleReadyPhaseKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();

      // ★ 連打防止: 既に開始処理中なら何もしない
      if (isStartingRef.current) return;
      isStartingRef.current = true; // 鍵をかける

      playSE("start");
      setPlayPhase("go");

      // 1秒後にゲーム開始
      startTimerIdRef.current = window.setTimeout(() => {
        setPlayPhase("game");
        startGame();
        playBGM(DIFFICULTY_SETTINGS[difficulty].bgm);
        // 処理が終わったら鍵を開ける（念のため）
        isStartingRef.current = false;
      }, 1000);
    } else if (e.key === "Escape") {
      e.preventDefault();
      // タイマーが動いていたらキャンセル（ゾンビタイマー防止）
      if (startTimerIdRef.current) clearTimeout(startTimerIdRef.current);
      isStartingRef.current = false; // 鍵を強制解除
      playSE("decision");
      backToDifficulty();
    }
  });

  // -------------------------------------------------------------
  // ゲームプレイ中のキー処理
  // -------------------------------------------------------------
  const handleGamePhaseKey = useEffectEvent((e: KeyboardEvent) => {
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
      handleBackspace(); // 文字削除
      return;
    }

    // 難易度からフラグを取得しておく
    const currentConfig = DIFFICULTY_SETTINGS[difficulty];
    const isEnglishMode = currentConfig.isEnglish ?? false;

    // 単一文字入力（a-zなど）のみ通す
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // 英語モードなら入力されたキーをそのまま渡す、日本語モードならローマ字モードで小文字に変換
      const inputChar = isEnglishMode ? e.key : e.key.toLowerCase();
      handleKeyInput(inputChar);
    }
  });

  // -------------------------------------------------------------
  // リザルト画面のキー処理
  // -------------------------------------------------------------
  const handleResultKey = useEffectEvent((e: KeyboardEvent) => {
    const currentRank = lastGameStats ? lastGameStats.rank : rank;

    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();

      // アニメーション途中ならスキップして即return
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

      if (!isResultSkipCoolDownRef.current) {
        if (e.key === "Enter") {
          playSE("decision");
          retryGame();
        } else {
          playSE("decision");
          backToDifficulty();
        }
      }
    }
  });

  // -------------------------------------------------------------
  // メインのキー入力ハンドラ（ガード処理 + 状態ごとの振り分け）
  // -------------------------------------------------------------
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
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
    // ファンクションキーでFだけCapsLockの影響を受ける面白いバグが起きたので
    // Fの判定も行っている。
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
        if (playPhase === "ready") handleReadyPhaseKey(e);
        else if (playPhase === "game") handleGamePhaseKey(e);
        break;
      case "result":
        handleResultKey(e);
        break;
    }
  });

  useEffect(() => {
    // -------------------------------------------------------------
    // IME (日本語入力) 監視イベント
    // -------------------------------------------------------------
    const handleCompositionStart = () => {
      isComposingRef.current = true; // 入力開始
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false; // 変換確定
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("compositionstart", handleCompositionStart, true);
    window.addEventListener("compositionend", handleCompositionEnd, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener(
        "compositionstart",
        handleCompositionStart,
        true,
      );
      window.removeEventListener("compositionend", handleCompositionEnd, true);

      // 画面遷移時にタイマーやフラグを確実にリセットする
      if (startTimerIdRef.current) clearTimeout(startTimerIdRef.current);
      isStartingRef.current = false;
    };
  }, []); // 依存配列は空！(useEffectEventのおかげ)
};
