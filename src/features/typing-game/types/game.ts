import type { DifficultyLevel,GameState } from "../../../types";

export type PlayPhase = "ready" | "go" | "game";

export type MissedWord = { word: string; misses: number };

export type WeakWord = {
  word: string;
  misses: number;
};

export type GameStats = {
  score: number;
  completedWords: number;
  correctCount: number;
  missCount: number;
  backspaceCount: number;
  maxCombo: number;
  currentSpeed: number;
  rank: string;
  missedWordsRecord: { word: string; misses: number }[];
  missedCharsRecord: { [key: string]: number };
  jpText: string;
  currentWordMiss: number;
};

export type GameResultStats = {
  score: number;
  words: number;
  correct: number;
  miss: number;
  backspace: number;
  combo: number;
  speed: number;
  rank: string;
  weakWords: WeakWord[];
  weakKeys: { [key: string]: number };
};

// useGameControl 等が受け取る引数型 (typing-game プレイ全体のコントロール)
export type GameControlProps = {
  gameState: GameState;
  playPhase: PlayPhase;
  difficulty: DifficultyLevel;
  timeLeft: number;
  tick: (amount: number) => void;
  setGameState: (state: GameState) => void;
  processResult: (stats: GameResultStats) => void;
  currentStats: GameStats;
};
