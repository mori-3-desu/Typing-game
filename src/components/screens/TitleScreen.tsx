import React, { type ReactNode } from "react";

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
  children?: ReactNode;
  handleStartSequence: () => void;
  handleOpenHowToPlay: () => void;
  handleOpenConfig: () => void;
  handleCancelInput: () => void;
  handleNameSubmit: () => void;
  handleBackToInput: () => void;
  handleFinalConfirm: () => void;
};

/**
 * 0:00（深夜0時）から8:00までサーバーが停止する為、
 * アクセシビリティとクラスを付け替える為に実装している
 * default引数にしているのはテスト容易性の為で中に記述すると
 * 現在の時刻に依存してしまい、テストでモックが必要になる。
 */
const isMidnightToEightAM = (date = new Date()) => {
  const hourPart = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "numeric",
  })
    .formatToParts(date) // [{type: "hours", value: "??"}]
    .find((part) => part.type === "hour"); // {type: "hours", value: "??"}

  const hours = Number(hourPart?.value);
  const isAfterMidnight = hours >= 0;
  const isBeforeEightAM = hours < 8;

  return isAfterMidnight && isBeforeEightAM;
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
  children,
  handleStartSequence,
  handleOpenHowToPlay,
  handleOpenConfig,
  handleCancelInput,
  handleNameSubmit,
  handleBackToInput,
  handleFinalConfirm,
}) => {
  const shouldShowStopDescription = isMidnightToEightAM();

  return (
    <div className={"title-screen"}>
      <div
        className={`handoff-position fade-element ${
          showTitle ? "visible" : ""
        } ${titlePhase !== "normal" || isTitleExiting ? "exit-fade" : ""}
            ${!enableBounce ? "no-click" : ""}`}
      >
        {children}
      </div>

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

        <div
          className={`title-note 
            ${showTitle ? "visible" : ""} 
            ${titlePhase !== "normal" || isTitleExiting ? "fade-out" : ""}
            ${shouldShowStopDescription ? "warm-maker" : ""}
            `}
          role={shouldShowStopDescription ? "alert" : ""}
          aria-label="サーバー保存に関する重要なお知らせ"
        >
          <p>
            0:00～8:00の間はサーバーへのデータ保存が出来ません。上記の時間帯はローカルのみ保存可能です。
          </p>
        </div>
      </div>

      {/* 名前入力モーダル */}
      {titlePhase === "input" && (
        <div
          className="pop-modal-frame fade-in-pop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <label
            htmlFor="player-name-input"
            id="modal-title"
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
            <SoundBtn className="pop-btn primary" onClick={handleNameSubmit}>
              OK
            </SoundBtn>
            <SoundBtn className="pop-btn" onClick={handleCancelInput}>
              戻る
            </SoundBtn>
          </div>
        </div>
      )}

      {/* 名前確認モーダル */}
      {titlePhase === "confirm" && (
        <div
          className="pop-modal-frame fade-in-pop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-check-name"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="pop-label" id="modal-check-name">
            以下の名前で始めます。
            <br />
            よろしいですか？
          </p>

          <div className="confirm-name-disp">{playerName}</div>

          <div>
            <SoundBtn className="pop-btn primary" onClick={handleFinalConfirm}>
              はい
            </SoundBtn>
            <SoundBtn className="pop-btn" onClick={handleBackToInput}>
              いいえ
            </SoundBtn>
          </div>
          <p className="pop-note">※名前は後からでも変更できます。</p>
        </div>
      )}
    </div>
  );
};
