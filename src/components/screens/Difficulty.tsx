import React from "react";

import { SoundBtn } from "../../common/SoundBtn";
import { ScoreService } from "../../services/scoreService";
import { type DifficultyLevel } from "../../types";
import { DIFFICULTY_ORDER, DIFFICULTY_SETTINGS } from "../../utils/constants";

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
}) => {
  // 表示用の難易度とハイスコアを計算
  const displayDiff = hoverDifficulty || difficulty;
  const displayHighScore = ScoreService.getHighScore(displayDiff);

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
            <SoundBtn
              key={diff}
              className={`diff-btn ${diff.toLowerCase()}`}
              onMouseEnter={() => handleMouseEnter(diff)}
              onClick={() => handleSelectDifficulty(diff)}
            >
              {diff}
            </SoundBtn>
          ))}
        </div>

        <div className="diff-btn-wrapper">
          <SoundBtn className="btn-back diff-btn" onClick={backToTitle}>
            BACK
          </SoundBtn>
        </div>

        <div className={`diff-info-panel visible`}>
          <>
            <div className="diff-header-group">
              <SoundBtn onClick={() => fetchRanking(displayDiff)}>
                <img
                  src="/images/ranking.png"
                  alt="Ranking"
                  className="crown-icon-only"
                />
              </SoundBtn>

              <div className="diff-hiscore-box">
                <div className="hiscore-label-group">
                  <SoundBtn
                    className="hiscore-detail-btn"
                    onClick={() => {
                      handleShowHighScoreDetail();
                    }}
                    title="詳細リザルトを見る"
                  >
                    📄
                  </SoundBtn>
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

            {/* TODO: マジックナンバーを修正する */}
            <p className="display-diff-text">
              {DIFFICULTY_SETTINGS[displayDiff].text
                .split("\n")
                .map((line, index, array) => {
                  // 行の先頭が「※」で始まっているか判定
                  const isWarning = line.startsWith("※");

                  return (
                    <span
                      key={index}
                      style={{
                        color: isWarning ? "#ffff00" : "inherit",
                        // ちょっと文字を小さくして注釈っぽくするのもアリです
                        fontSize: isWarning ? "0.85em" : "inherit",
                      }}
                    >
                      {line}
                      {/* 最後の行以外には <br /> を入れて改行する */}
                      {index < array.length - 1 && <br />}
                    </span>
                  );
                })}
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
