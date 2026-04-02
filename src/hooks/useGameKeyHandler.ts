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
  const isStartingRef = useRef(false); // Ready画面で「Enter」を連打された時に、ゲーム開始処理が重複しないようにする鍵
  const isResultSkipCoolDownRef = useRef(false); // リザルト画面で「スキップ」した直後の誤操作（リトライ等）を防ぐためのクールダウン
  const isComposingRef = useRef(false); // IME（日本語入力）中かどうかを厳密に管理するフラグ
  const startTimerIdRef = useRef<number | null>(null); // タイマーID保管用
  const coolDownTimerRef = useRef<number | null>(null); // リザルトスキップのクリーンアップ用

  // clearTimerが増えたらReact.RefObjectで共通化を検討する。
  const clearStartTimer = () => {
    if (startTimerIdRef.current) {
      clearTimeout(startTimerIdRef.current);
      startTimerIdRef.current = null;
    }
    isStartingRef.current = false;
  };

  const clearCoolDownTimer = () => {
    if (coolDownTimerRef.current) {
      clearTimeout(coolDownTimerRef.current)
      coolDownTimerRef.current = null
    }
    isResultSkipCoolDownRef.current = false
  }

  const handleGameStart = () => {
    // 連打防止: 既に開始処理中なら何もしない
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    playSE("start");
    setPlayPhase("go");

    // 1秒後にゲーム開始
    startTimerIdRef.current = window.setTimeout(() => {
      setPlayPhase("game");
      startGame();
      playBGM(DIFFICULTY_SETTINGS[difficulty].bgm);
      clearStartTimer();
    }, 1000);
  };

  const handleReadyCancel = () => {
    clearStartTimer();
    playSE("decision");
    backToDifficulty();
  };

  // -------------------------------------------------------------
  // Ready画面のキー処理
  // useEffectEvent: レンダーごとに最新の props を自動でキャプチャする
  // (Latest Ref Pattern の手動同期が不要になる)
  // -------------------------------------------------------------
  const handleReadyPhaseKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleGameStart();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleReadyCancel();
    }
  });

  // 英語モードなら入力されたキーをそのまま渡す、日本語モードならローマ字モードで小文字に変換
  const normalizeKey = (e: KeyboardEvent): string => {
    const isEnglishMode = DIFFICULTY_SETTINGS[difficulty].isEnglish ?? false;
    return isEnglishMode ? e.key : e.key.toLowerCase();
  };

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
      resetToReady();
      return;
    }
    if (e.key === "Backspace") {
      handleBackspace();
      return;
    }

    // 単一文字入力（a-zなど）のみ通す
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      handleKeyInput(normalizeKey(e));
    }
  });

  const skipWithCooldown = (rank: string) => {
    skipAnimation(rank);

    // スキップ直後に誤操作しないよう、0.5秒の不感時間を設ける
    isResultSkipCoolDownRef.current = true;
    coolDownTimerRef.current = window.setTimeout(() => {
      clearCoolDownTimer();
    }, 500);
  };

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
        skipWithCooldown(currentRank);
        return;
      }

      if (isResultSkipCoolDownRef.current) return;
      playSE("decision");

      if (e.key === "Enter") {
        retryGame();
      } else {
        backToDifficulty();
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
      clearStartTimer();
      clearCoolDownTimer();
    };
  }, []); // 依存配列は空！(useEffectEventのおかげ)
};
