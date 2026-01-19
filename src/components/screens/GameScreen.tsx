import {
  type DifficultyLevel,
  type RomaState,
  type Segment,
  type Popup,
  type ScorePopup,
} from "../../types";

type Props = {
  gameState: "playing" | "finishing";
  playPhase: "ready" | "go" | "game";
  difficulty: DifficultyLevel;
  score: number;
  displayScore: number;
  combo: number;
  comboClass: string;
  timeLeft: number;
  isTimeAdded: boolean;
  gaugeValue: number;
  gaugeMax: number;
  completedWords: number;
  currentSpeed: string;
  jpText: string;
  romaState: RomaState;
  showRomaji: boolean;
  allSegments: Segment[];
  shakeStatus: string;
  rank: string;
  bonusPopups: Popup[];
  perfectPopups: { id: number }[];
  scorePopups: ScorePopup[];
  isRainbowMode: boolean;
  isFinishExit: boolean;
};

export const GameScreen = ({
  gameState,
  playPhase,
  difficulty,
  displayScore,
  combo,
  comboClass,
  timeLeft,
  isTimeAdded,
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
  bonusPopups,
  perfectPopups,
  scorePopups,
  isFinishExit,
}: Props) => {
  // まだ ready の時は表示しない、などの制御
  if (playPhase === "ready") return null;

  const hasPunctuation = jpText.endsWith("。") || jpText.endsWith("、");

  return (
    <div id="game-hud" style={{ zIndex: 10 }}>
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
      <div
        id="finish-banner"
        className={`${gameState === "finishing" ? "show" : ""} ${
          isFinishExit ? "exit" : ""
        }`}
      >
        FINISH!
      </div>

      <div id="score-container">
        SCORE: <span id="score">{displayScore}</span>
        <div id="score-popups">
          {scorePopups.map((p) => (
            <div key={p.id} className={`score-popup ${p.type}`}>
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
        id="center-area"
        style={{
          opacity: playPhase === "game" && gameState !== "finishing" ? 1 : 0,
          transition: "opacity 0.2s",
        }}
      >
        <div id="text-word-wrapper">
          <div
            id="text-word"
            className={
              shakeStatus === "light"
                ? "light-shake"
                : shakeStatus === "error"
                  ? "error-shake"
                  : ""
            }
            style={{
              padding: showRomaji ? "20px 65px" : "20px 30px",
              transition: "padding 0.3s ease",
            }}
          >
            <div id="romaji-line">
              {romaState.typedLog.map((log, i) => (
                <span key={i} style={{ color: log.color }}>
                  {log.char}
                </span>
              ))}
              <span
                className="text-yellow"
                style={{ textDecoration: "underline" }}
              >
                {romaState.current}
              </span>
              <span style={{ color: "white" }}>{romaState.remaining}</span>
            </div>

            <div
              id="jp-line"
              className={hasPunctuation ? "has-punctuation" : ""}
            >
              {jpText}
            </div>

            <div
              id="full-roma"
              className={hasPunctuation ? "has-punctuation" : ""}
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
          {bonusPopups.map((p) => (
            <div key={p.id} className={`bonus-pop ${p.type}`}>
              {p.text}
            </div>
          ))}
          <div id="rank-monitor" style={{ whiteSpace: "nowrap" }}>
            RANK{" "}
            <span id="rank-value" className={`rank-${rank.toLowerCase()}`}>
              {rank}
            </span>
          </div>
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

      <div id="tmr-box">
        <img src="/images/cloud.png" id="tmr-img" alt="雲" />
        <span
          id="tmr-text"
          className={
            isTimeAdded
              ? "time-plus"
              : timeLeft <= 10
                ? "timer-pinch"
                : "timer-normal"
          }
        >
          {Math.ceil(timeLeft)}
        </span>
      </div>

      <div id="combo-meter" className={`theme-${difficulty.toLowerCase()}`}>
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
          {currentSpeed} <span className="stat-unit">key/s</span>
        </span>
      </div>
    </div>
  );
};
