import React from "react";

import { SoundBtn } from "../../common/SoundBtn";
import { type TitlePhase } from "../../types";

type TitleScreenProps = {
  // 表示制御系
  showTitle: boolean;
  enableBounce: boolean;
  titlePhase: TitlePhase;
  isTitleExiting: boolean;
  isNameConfirmed: boolean;
  // データ系
  playerName: string;
  setPlayerName: (name: string) => void;
  nameError: string;
  setNameError: (error: string) => void;
  // アクション系（関数）
  handleStartSequence: () => void;
  handleOpenHowToPlay: () => void;
  handleOpenConfig: () => void;
  handleCancelInput: () => void;
  handleNameSubmit: () => void;
  handleBackToInput: () => void;
  handleFinalConfirm: () => void;
};

export const TitleScreen: React.FC<TitleScreenProps> = ({
  showTitle,
  enableBounce,
  titlePhase,
  isTitleExiting,
  isNameConfirmed,
  playerName,
  setPlayerName,
  nameError,
  setNameError,
  handleStartSequence,
  handleOpenHowToPlay,
  handleOpenConfig,
  handleCancelInput,
  handleNameSubmit,
  handleBackToInput,
  handleFinalConfirm,
}) => {
  return (
    <div className={"title-screen"}>
      <div
        className={`title-content-wrapper ${
          titlePhase !== "normal" ? "exit" : "enter"
        }`}
      >
        <div
          className={`title-anim-wrapper ${showTitle ? "visible" : ""} ${
            titlePhase !== "normal" || isTitleExiting ? "exit-up" : ""
          }`}
        >
          <h1 className={`game-title ${enableBounce ? "bouncing" : ""}`}>
            CRITICAL TYPING
          </h1>
        </div>

        <div
          className={`main-menu-buttons fade-element ${
            showTitle ? "visible" : ""
          } ${titlePhase !== "normal" || isTitleExiting ? "exit-down" : ""}
            ${!enableBounce ? "no-click" : ""}`}
        >
          <SoundBtn
            className="menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleStartSequence();
            }}
          >
            ゲームスタート
          </SoundBtn>
          <SoundBtn
            className="menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenHowToPlay();
            }}
          >
            遊び方
          </SoundBtn>
          {isNameConfirmed && (
            <SoundBtn className="menu-btn" onClick={handleOpenConfig}>
              設定
            </SoundBtn>
          )}
        </div>
      </div>

      {/* 名前入力モーダル */}
      {titlePhase === "input" && (
        <div
          className="pop-modal-frame fade-in-pop"
          onClick={(e) => e.stopPropagation()}
        >
          <label
            htmlFor="player-name-input"
            className="pop-label"
            style={{ textAlign: "center", width: "100%", margin: 0 }}
          >
            名前を入力してください
          </label>

          <input
            type="text"
            id="player-name-input"
            className={`pop-input ${nameError ? "input-error-shake" : ""}`}
            value={playerName}
            onChange={(e) => {
              setPlayerName(e.target.value);
              if (nameError) setNameError("");
            }}
            maxLength={10}
            placeholder="Guest"
            autoFocus
            style={{ marginTop: "15px", transition: "all 0.3s" }}
          />

          <div
            style={{
              height: "20px",
              marginTop: "5px",
              width: "100%",
              textAlign: "center",
            }}
          >
            {nameError ? (
              <p
                role="alert"
                className="error-fade-in"
                style={{
                  fontSize: "0.85rem",
                  color: "#ff4444",
                  margin: 0,
                  fontWeight: "bold",
                }}
              >
                {nameError}
              </p>
            ) : (
              <p className="pop-note" style={{ margin: 0 }}>
                ※名前はあとからでも変更出来ます
              </p>
            )}
          </div>

          <div
            style={{
              marginTop: "15px",
              display: "flex",
              gap: "15px",
              justifyContent: "center",
            }}
          >
            <SoundBtn className="pop-btn" onClick={handleCancelInput}>
              キャンセル
            </SoundBtn>
            <SoundBtn className="pop-btn primary" onClick={handleNameSubmit}>
              OK
            </SoundBtn>
          </div>
        </div>
      )}

      {/* 名前確認モーダル */}
      {titlePhase === "confirm" && (
        <div
          className="pop-modal-frame fade-in-pop"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="pop-label">
            以下の名前で始めます。
            <br />
            よろしいですか？
          </label>
          <div className="confirm-name-disp">{playerName}</div>
          <div
            style={{
              marginTop: "25px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <SoundBtn className="pop-btn" onClick={handleBackToInput}>
              戻る
            </SoundBtn>
            <SoundBtn className="pop-btn primary" onClick={handleFinalConfirm}>
              はい
            </SoundBtn>
          </div>
          <p className="pop-note">※名前は後からでも変更できます。</p>
        </div>
      )}
    </div>
  );
};
