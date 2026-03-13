import React from "react";
// パスは環境に合わせて調整してください
import { type DifficultyLevel } from "../../types";
import { DIFFICULTY_ORDER, DIFFICULTY_SETTINGS } from "../../utils/constants";
import { getSavedHighScore } from "../../utils/storage";

type Props = {
  difficulty: DifficultyLevel;
  setDifficulty: (diff: DifficultyLevel) => void;
  hoverDifficulty: DifficultyLevel | null;
  setHoverDifficulty: (diff: DifficultyLevel | null) => void;
  isInputLocked: boolean;
  isTransitioning: boolean;

  // アクション系
  handleSelectDifficulty: (diff: DifficultyLevel) => void;
  backToTitle: () => void;
  fetchRanking: (diff: DifficultyLevel) => void;
  handleShowHighScoreDetail: () => void;
  playDecisionSound: () => void;
};

export const DifficultySelectScreen: React.FC<Props> = ({
  difficulty,
  setDifficulty,
  hoverDifficulty,
  setHoverDifficulty,
  isInputLocked,
  isTransitioning,
  handleSelectDifficulty,
  backToTitle,
  fetchRanking,
  handleShowHighScoreDetail,
  playDecisionSound,
}) => {
  // 表示用の難易度とハイスコアを計算
  const displayDiff = hoverDifficulty || difficulty;
  const displayHighScore = getSavedHighScore(displayDiff);

  // 設定データ
  const currentSetting = DIFFICULTY_SETTINGS[displayDiff];

  const handleMouseEnter = (diff: DifficultyLevel) => {
    if (!isTransitioning && !isInputLocked) {
      setHoverDifficulty(diff);
      setDifficulty(diff);
    }
  };

  const handleMenuLeave = () => {
    if (!isTransitioning && !isInputLocked) {
      setHoverDifficulty(null);
    }
  };

  return (
    <div id="difficulty-view" style={{ position: "absolute", zIndex: 5 }}>
      <h1 className="diff-view-title">SELECT DIFFICULTY</h1>
      <div className="diff-main-container">
        <div
          className={`diff-button-menu ${isInputLocked ? "no-click" : ""}`}
          onMouseLeave={handleMenuLeave}
        >
          {DIFFICULTY_ORDER.map((diff) => (
            <button
              key={diff}
              className={`diff-btn ${diff.toLowerCase()}`}
              onMouseEnter={() => handleMouseEnter(diff)}
              onClick={() => handleSelectDifficulty(diff)}
            >
              {diff}
            </button>
          ))}
          <button id="btn-back" className="diff-btn" onClick={backToTitle}>
            BACK
          </button>
        </div>

        <div className={`diff-info-panel visible`}>
          <>
            <div className="diff-header-group">
              <img
                src="/images/ranking.png"
                alt="Ranking"
                className="crown-icon-only"
                onClick={() => fetchRanking(displayDiff)}
              />
              <div className="diff-hiscore-box">
                <div className="hiscore-label-group">
                  <button
                    className="hiscore-detail-btn"
                    onClick={() => {
                      playDecisionSound();
                      handleShowHighScoreDetail();
                    }}
                    title="詳細リザルトを見る"
                  >
                    📄
                  </button>
                  <span className="label">HI-SCORE</span>
                </div>
                <span id="menu-hiscore-val">
                  {displayHighScore.toLocaleString()}
                </span>
              </div>
            </div>
            <h2 id="display-diff-name" style={{ color: currentSetting.color }}>
              {displayDiff}
            </h2>
            <p id="display-diff-text">
              {DIFFICULTY_SETTINGS[displayDiff].text}
            </p>
            <div className="diff-info-footer">
              <div className="status-item" id="display-diff-time">
                {DIFFICULTY_SETTINGS[displayDiff].time}s
              </div>
              <div className="status-item" id="display-diff-chars">
                {DIFFICULTY_SETTINGS[displayDiff].chars}
              </div>
            </div>
          </>
        </div>
      </div>
    </div>
  );
};
