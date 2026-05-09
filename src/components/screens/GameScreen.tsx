import type { Segment } from "../../features/typing-game/logic/segment";
import type {
  RomaState,
  ScorePopup,
  TimePopup,
} from "../../features/typing-game/types";
import { type DifficultyLevel } from "../../types";

type Props = {
  gameState: "playing" | "finishing";
  playPhase: "ready" | "go" | "game";
  difficulty: DifficultyLevel;
  displayScore: number;
  combo: number;
  comboClass: string;
  timeLeft: number;
  gaugeValue: number;
  gaugeMax: number;
  completedWords: number;
  currentSpeed: number;
  jpText: string;
  romaState: RomaState;
  showRomaji: boolean;
  allSegments: Segment[];
  shakeStatus: string;
  rank: string;
  perfectPopups: { id: number }[];
  scorePopups: ScorePopup[];
  timePopups: TimePopup[];
  isFinishExit: boolean;
};

/**
 * 句読点は全角で微妙に中心からずれる為、インデントを調整する。
 * ワードデータに「、」で終わるものは存在しないため「。」のみチェック。
 */
const applyIndentIfHasPeriod = (jpText: string): string => {
  if (!jpText.endsWith("。")) return "";
  return "has-punctuation";
};

const gameTimerClass = (timeLeft: number, hasTimePopups: boolean): string => {
  if (hasTimePopups) return "time-plus";
  if (timeLeft <= 0) return "timer-zero";
  if (timeLeft <= 10) return "timer-pinch";
  return "timer-normal";
};

/**
 * ミスタイプは小さく揺らす(light)
 * 最後の単語まで気づかずにミスした場合は大きく揺らす(error)
 */
const gameShakeClass = (shakeStatus: string): string => {
  if (shakeStatus === "light") return "light-shake";
  if (shakeStatus === "error") return "error-shake";
  return "";
};

export const GameScreen = ({
  gameState,
  playPhase,
  difficulty,
  displayScore,
  combo,
  comboClass,
  timeLeft,
  gaugeValue,
  gaugeMax,
  completedWords,
  currentSpeed,
  jpText,
  romaState,
  showRomaji,
  allSegments,
  shakeStatus,
  rank,
  perfectPopups,
  scorePopups,
  timePopups,
  isFinishExit,
}: Props) => {
  // まだ ready の時は表示しない、などの制御
  if (playPhase === "ready") return null;

  return (
    <div className="game-hud" style={{ zIndex: 10 }}>
      {playPhase === "game" && gameState !== "finishing" && (
        <div
          className="blink-guide"
          style={{
            position: "absolute",
            top: "740px",
            width: "100%",
            textAlign: "center",
            zIndex: 100,
          }}
        >
          — Escキーで最初からやり直す —
        </div>
      )}

      <div className="finish-banner-wrapper">
        {(gameState === "finishing") && (
          <div
            aria-live="assertive"
            className={`finish-banner ${isFinishExit ? "exit" : "show"}`}
          >
            FINISH!
          </div>
        )}
      </div>

      <div className="score-container">
        SCORE: <span className="score">{displayScore}</span>
        <div className="score-popups">
          {scorePopups.map((p) => (
            <div key={p.id} className={`score-popup-item ${p.type}`}>
              {p.text}
            </div>
          ))}
        </div>
      </div>

      <div id="perfect-container">
        {perfectPopups.map((p) => (
          <div key={p.id} className="perfect-item">
            PERFECT!!
          </div>
        ))}
      </div>

      <div
        className={`center-container ${difficulty === "EXTRA" ? "font-extra" : ""}`}
        style={{
          opacity: playPhase === "game" && gameState !== "finishing" ? 1 : 0,
          transition: "opacity 0.2s",
        }}
      >
        <div
          key={jpText}
          className={`text-word ${gameShakeClass(shakeStatus)}`}
        >
          {/* EXTRAはスペースも判定範囲なので視覚的に表示する */}
          <div className="romaji-line">
            {/* typedLog
            は末尾への追加のみ。並び替えが起きないため index
            を key に使用 */}
            {romaState.typedLog.map((log, index) => (
              <span key={index} style={{ color: log.color }}>
                {log.char === " " ? "␣" : log.char}
              </span>
            ))}

            <span
              className="text-yellow"
              style={{ textDecoration: "underline" }}
            >
              {romaState.current === " " ? "␣" : romaState.current}
            </span>
            <span style={{ color: "white" }}>
              {romaState.remaining.replaceAll(" ", "␣")}
            </span>
          </div>

          <div className={`jp-line ${applyIndentIfHasPeriod(jpText)}`}>
            {jpText}
          </div>

          <div
            className="full-roma"
            style={{ display: showRomaji ? "block" : "none" }}
          >
            {allSegments.map((seg, i) => (
              <span key={i} className="segment-group">
                {seg.display.split("").map((char, charIdx) => (
                  <span
                    key={charIdx}
                    style={{
                      opacity: charIdx < seg.inputBuffer.length ? 0.3 : 1,
                    }}
                  >
                    {char}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        <div className={`rank-monitor rank-${rank.toLowerCase()}`}>
          RANK <span className="rank-value">{rank}</span>
        </div>
      </div>

      {/* コンボ表示エリア */}
      <div id="combo-box">
        <div key={combo} className={combo > 0 ? "combo-pop-anim" : ""}>
          <div id="combo-count" className={comboClass} data-text={combo}>
            {combo}
            <div id="combo-label" className={comboClass} data-text="COMBO">
              COMBO
            </div>
          </div>
        </div>
      </div>

      <div className="tmr-box">
        <img src="/images/cloud.webp" className="tmr-img" alt="雲" />
        <span
          className={`tmr-text ${gameTimerClass(timeLeft, timePopups.length > 0)}`}
        >
          {Math.ceil(timeLeft)}
        </span>
      </div>

      {timePopups.map((p) => (
        <div
          key={p.id}
          className={`bonus-pop ${p.isLarge ? "large" : "normal"}`}
        >
          {p.text}
        </div>
      ))}

      <div className={`combo-meter theme-${difficulty.toLowerCase()}`}>
        <div className="meter-header">
          <span>連打メーター</span>
          <span>+10秒</span>
        </div>
        <div id="meter-bar">
          <div
            id="meter-fill"
            style={{
              width: `${Math.min(100, (gaugeValue / gaugeMax) * 100)}%`,
            }}
          ></div>
        </div>
      </div>

      <div id="word-counter">
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend>WORDS</legend>
          <span id="stat-words">{completedWords}</span>
        </fieldset>
      </div>

      <div id="hud-stats">
        <span className="speed-label">Speed: </span>
        <span id="stat-speed">
          {currentSpeed.toFixed(2)} <span className="stat-unit">key/s</span>
        </span>
      </div>
    </div>
  );
};
