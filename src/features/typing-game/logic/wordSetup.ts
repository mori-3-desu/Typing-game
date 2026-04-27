import type { DifficultyLevel, RomaState, Word, WordList } from "../../../types";
import { DIFFICULTY_SETTINGS } from "../../../utils/constants";
import { TypingEngine } from "./typingEngine";

type WordSetup = {
  nextWord: Word, 
  engine: TypingEngine,
  romaState: RomaState
}

const selectNextWord = (
  list: WordList,
  excludeJp: string,
  random: () => number = Math.random,
): Word => {
  if (list.length === 0) throw new Error("WordList is empty");
  const candidates = list.filter((word) => word.jp !== excludeJp);

  // バグ等で候補が空になったら元のリストを使う
  const targetList = candidates.length > 0 ? candidates : list;
  const randomIndex = Math.floor(random() * targetList.length);
  return targetList[randomIndex];
};

// まだ一文字も打っていない状態（1文字目がターゲット）のデータを作る
const getInitialRomaState = (engine: TypingEngine): RomaState => {
  if (!engine.segments.length) {
    return { typedLog: [], current: "", remaining: "" };
  }

  const firstSeg = engine.segments[0];
  return {
    typedLog: [],
    current: firstSeg.getCurrentChar(), // 例: "k"
    remaining: firstSeg.getRemaining(), // 例: "a"
  };
};

// EXTRAの特殊モードはローマ字判定を不可に
const getIsEnglishMode = (difficulty: DifficultyLevel): boolean => {
  return DIFFICULTY_SETTINGS[difficulty].isEnglish ?? false;
};

// 新しい単語のローマ字を渡し、判定ロジック(Class)を新品にする。
// これにより、前の単語の入力履歴などはすべてリセットされる。
const initializeEngine = (word: Word, isEnglish: boolean): TypingEngine => {
  return new TypingEngine(word.roma, isEnglish);
};

export const buildWordSetup = (
  list: WordList,
  excludeJp: string,
  difficulty: DifficultyLevel,
): WordSetup => {
  const nextWord = selectNextWord(list, excludeJp);
  const isEnglishMode = getIsEnglishMode(difficulty);
  const engine = initializeEngine(nextWord, isEnglishMode);
  const romaState = getInitialRomaState(engine);

  return {
    nextWord,
    engine,
    romaState,
  };
};