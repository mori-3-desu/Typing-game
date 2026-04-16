import type {
  BonusPopup,
  MissedWord,
  PerfectPopup,
  RomaState,
  ScorePopup,
  TimePopup,
} from "../../../types";
import { GAUGE_CONFIG } from "../../../utils/constants";
import { Segment } from "./typingEngine";

// --- State Definitions ---
interface GameState {
  score: number;
  timeLeft: number;
  elapsedTime: number;
  combo: number;
  maxCombo: number;
  gaugeValue: number;
  gaugeMax: number;
  jpText: string;
  romaState: RomaState;
  allSegments: Segment[];
  correctCount: number;
  missCount: number;
  backspaceCount: number;
  completedWords: number;
  currentWordMiss: number;
  missedWordsRecord: MissedWord[];
  missedCharsRecord: Record<string, number>;
  shakeStatus: "none" | "light" | "error";
  bonusPopups: BonusPopup[];
  scorePopups: ScorePopup[];
  timePopups: TimePopup[];
  perfectPopups: PerfectPopup[];
}

export const initialState: GameState = {
  score: 0,
  timeLeft: 0,
  elapsedTime: 0,
  combo: 0,
  maxCombo: 0,
  gaugeValue: 0,
  gaugeMax: GAUGE_CONFIG.INITIAL_MAX,
  jpText: "",
  romaState: { typedLog: [], current: "", remaining: "" },
  allSegments: [],
  correctCount: 0,
  missCount: 0,
  backspaceCount: 0,
  completedWords: 0,
  currentWordMiss: 0,
  missedWordsRecord: [],
  missedCharsRecord: {},
  shakeStatus: "none",
  bonusPopups: [],
  scorePopups: [],
  timePopups: [],
  perfectPopups: [],
};

type GameAction =
  | { type: "RESET"; initialTime: number }
  | {
      type: "LOAD_WORD";
      jp: string;
      romaState: RomaState;
      segments: Segment[];
    }
  | {
      type: "UPDATE_DISPLAY";
      romaState: RomaState;
      segments: Segment[];
    }
  | { type: "TICK"; amount: number }
  | { type: "ADD_TIME"; sec: number }
  | { type: "ADD_TIME_POPUP"; popup: TimePopup }
  | { type: "REMOVE_TIME_POPUP"; id: number }
  | { type: "BACKSPACE"; penalty: number }
  | {
      type: "MISS";
      missType: "INPUT" | "COMPLETION";
      charStr?: string;
      penalty: number;
      gaugePenalty: number;
    }
  | { type: "CORRECT_HIT"; addScore: number; gaugeGain: number }
  | { type: "PERFECT_BONUS"; bonus: number }
  | { type: "RECORD_MISSED_WORD"; word: string; misses: number }
  | { type: "GAUGE_MAX_REACHED" }
  | { type: "SET_SHAKE"; status: "none" | "light" | "error" }
  | { type: "ADD_POPUP"; popup: BonusPopup }
  | { type: "REMOVE_POPUP"; id: number }
  | { type: "ADD_SCORE_POPUP"; popup: ScorePopup }
  | { type: "REMOVE_SCORE_POPUP"; id: number }
  | { type: "ADD_PERFECT_POPUP"; popup: PerfectPopup }
  | { type: "REMOVE_PERFECT_POPUP"; id: number };

export const gameReducer = (
  state: GameState,
  action: GameAction,
): GameState => {
  switch (action.type) {
    case "RESET":
      return { ...initialState, timeLeft: action.initialTime };
    case "LOAD_WORD":
      return {
        ...state,
        jpText: action.jp,
        currentWordMiss: 0,
        shakeStatus: "none",
        romaState: action.romaState,
        allSegments: action.segments,
      };
    case "UPDATE_DISPLAY":
      return {
        ...state,
        romaState: action.romaState,
        allSegments: action.segments,
      };
    case "TICK":
      return {
        ...state,
        timeLeft: Math.max(0, state.timeLeft - action.amount),
        elapsedTime: state.elapsedTime + action.amount,
      };
    case "ADD_TIME":
      return {
        ...state,
        timeLeft: state.timeLeft + action.sec,
      };
    case "ADD_TIME_POPUP":
      return {
        ...state,
        timePopups: [...state.timePopups, action.popup],
      };

    case "REMOVE_TIME_POPUP":
      return {
        ...state,
        timePopups: state.timePopups.filter((p) => p.id !== action.id),
      };
    case "BACKSPACE":
      return {
        ...state,
        score: Math.max(0, state.score - action.penalty),
        combo: 0,
        backspaceCount: state.backspaceCount + 1,
        shakeStatus: "none",
      };
    case "MISS": {
      const isInputMiss = action.missType === "INPUT";
      return {
        ...state,
        score: Math.max(0, state.score - action.penalty),
        gaugeValue: Math.max(0, state.gaugeValue - action.gaugePenalty),
        combo: 0,
        shakeStatus: isInputMiss ? "light" : "error",
        missCount: isInputMiss ? state.missCount + 1 : state.missCount,
        currentWordMiss: isInputMiss
          ? state.currentWordMiss + 1
          : state.currentWordMiss,
        missedCharsRecord:
          isInputMiss && action.charStr
            ? {
                ...state.missedCharsRecord,
                [action.charStr]:
                  (state.missedCharsRecord[action.charStr] || 0) + 1,
              }
            : state.missedCharsRecord,
      };
    }
    case "CORRECT_HIT": {
      const nextCombo = state.combo + 1;
      return {
        ...state,
        correctCount: state.correctCount + 1,
        combo: nextCombo,
        maxCombo: Math.max(state.maxCombo, nextCombo),
        score: state.score + action.addScore,
        gaugeValue: state.gaugeValue + action.gaugeGain,
        shakeStatus: "none",
      };
    }
    case "PERFECT_BONUS":
      return {
        ...state,
        score: state.score + action.bonus,
        completedWords: state.completedWords + 1,
      };
    case "RECORD_MISSED_WORD":
      return {
        ...state,
        missedWordsRecord: [
          ...state.missedWordsRecord,
          { word: action.word, misses: action.misses },
        ],
        completedWords: state.completedWords + 1,
      };
    case "GAUGE_MAX_REACHED":
      return {
        ...state,
        gaugeValue: 0,
        gaugeMax: Math.min(
          GAUGE_CONFIG.CEILING,
          state.gaugeMax + GAUGE_CONFIG.INCREMENT,
        ),
      };
    case "SET_SHAKE":
      return { ...state, shakeStatus: action.status };
    case "ADD_POPUP":
      return { ...state, bonusPopups: [...state.bonusPopups, action.popup] };
    case "REMOVE_POPUP":
      return {
        ...state,
        bonusPopups: state.bonusPopups.filter((p) => p.id !== action.id),
      };
    case "ADD_SCORE_POPUP":
      return { ...state, scorePopups: [...state.scorePopups, action.popup] };
    case "REMOVE_SCORE_POPUP":
      return {
        ...state,
        scorePopups: state.scorePopups.filter((p) => p.id !== action.id),
      };
    case "ADD_PERFECT_POPUP":
      return {
        ...state,
        perfectPopups: [...state.perfectPopups, action.popup],
      };
    case "REMOVE_PERFECT_POPUP":
      return {
        ...state,
        perfectPopups: state.perfectPopups.filter((p) => p.id !== action.id),
      };
    default:
      return state;
  }
};
