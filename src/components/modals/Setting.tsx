import { useEffect, useState } from "react";
import { PLAYER_NAME_CHARS, UI_TIMINGS } from "../../utils/setting";

type Props = {
  playerName: string;
  isMuted: boolean;
  bgmVol: number;
  seVol: number;
  showRomaji: boolean;
  ngWordsList: string[];

  // 状態を変更する関数たち
  setIsMuted: (val: boolean) => void;
  setBgmVol: (val: number) => void;
  setSeVol: (val: number) => void;
  setShowRomaji: (val: boolean) => void;

  // 名前保存処理 (Supabase連携などはApp側でやる)
  onSaveName: (newName: string) => Promise<void>;

  onClose: () => void;
  playDecisionSound: () => void;
};

export const Setting = ({
  playerName,
  isMuted,
  bgmVol,
  seVol,
  showRomaji,
  ngWordsList,
  setIsMuted,
  setBgmVol,
  setSeVol,
  setShowRomaji,
  onSaveName,
  onClose,
  playDecisionSound,
}: Props) => {
  // ★ App.tsx にあった入力用Stateをここに移動！
  const [tempPlayerName, setTempPlayerName] = useState(playerName);
  const [nameError, setNameError] = useState("");
  const [isNameChange, setIsNameChange] = useState("");

  // モーダルが開いた時に現在の名前をセット
  useEffect(() => {
    setTempPlayerName(playerName);
  }, [playerName]);

  const handleSubmit = async () => {
    const trimmedName = tempPlayerName.trim();
    setNameError("");

    if (!trimmedName) {
      setNameError("名前を入力してください");
      return;
    }
    if (trimmedName.length > PLAYER_NAME_CHARS.MAX) {
      setNameError(`名前は${PLAYER_NAME_CHARS.MAX}文字以内で入力してください`);
      return;
    }

    const isNg = ngWordsList.some((word) =>
      trimmedName.toLowerCase().includes(word.toLowerCase()),
    );

    if (isNg) {
      setNameError("不適切な文字が含まれています");
      return;
    }

    // App側の保存処理を呼ぶ
    await onSaveName(trimmedName);

    // 成功メッセージ表示
    setIsNameChange("名前を保存しました！");
    setTimeout(() => {
      setIsNameChange("");
    }, UI_TIMINGS.MESSAGE_AUTO_CLOSE);

    playDecisionSound();
  };

  return (
    <div className="config-overlay" onClick={onClose}>
      <div className="config-modal" onClick={(e) => e.stopPropagation()}>
        <h2
          className="config-title"
          style={{ marginBottom: "10px", flexShrink: 0 }}
        >
          SETTING
        </h2>

        <div className="config-scroll-area">
          {/* 名前変更エリア */}
          <div
            className="config-item"
            style={{
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "5px",
              marginBottom: "20px",
              width: "100%",
              padding: "0 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                width: "100%",
                alignItems: "flex-end",
              }}
            >
              <label
                style={{
                  fontSize: "0.9rem",
                  color: "#ccc",
                  marginLeft: "5px",
                }}
              >
                Player Name
              </label>
              {nameError && (
                <span
                  className="error-fade-in"
                  style={{
                    fontSize: "0.9rem",
                    marginLeft: "auto",
                    marginRight: "5px",
                  }}
                >
                  ⚠ ERROR
                </span>
              )}
            </div>

            <div
              style={{
                display: "flex",
                width: "100%",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                className={`pop-input-field ${
                  nameError ? "input-error-shake" : ""
                }`}
                value={tempPlayerName}
                maxLength={PLAYER_NAME_CHARS.MAX}
                onChange={(e) => {
                  setTempPlayerName(e.target.value);
                  if (nameError) setNameError("");
                }}
                placeholder="Guest"
                style={{
                  flex: 1,
                  margin: 0,
                  fontSize: "1.1rem",
                  padding: "8px 20px",
                  textAlign: "left",
                  transition: "all 0.3s",
                }}
              />
              <button
                className="btn-change-name"
                onClick={handleSubmit}
                style={{
                  whiteSpace: "nowrap",
                  padding: "10px 20px",
                  fontSize: "0.9rem",
                  height: "46px",
                }}
              >
                変更
              </button>
            </div>
            <div
              style={{
                height: "20px",
                marginTop: "5px",
                marginLeft: "5px",
                display: "flex",
                alignItems: "center",
              }}
            >
              {nameError ? (
                <p
                  className="error-fade-in"
                  style={{
                    fontSize: "0.85rem",
                    margin: 0,
                    color: "#ff4d4d",
                  }}
                >
                  {nameError}
                </p>
              ) : isNameChange ? (
                <p
                  className="fade-in"
                  style={{
                    fontSize: "0.85rem",
                    margin: 0,
                    color: "#4dff88",
                  }}
                >
                  ✓ {isNameChange}
                </p>
              ) : (
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "rgba(255,255,255,0.5)",
                    margin: 0,
                  }}
                >
                  ※変更可能、名前はランキングに反映されます
                </p>
              )}
            </div>
          </div>

          {/* その他設定項目 */}
          <div className="config-item">
            <label className="config-label">
              <input
                type="checkbox"
                checked={isMuted}
                onChange={(e) => setIsMuted(e.target.checked)}
              />
              <span className="checkbox-text">音量をミュートにする</span>
            </label>
          </div>

          <div className="config-item">
            <label className="config-label">
              <input
                type="checkbox"
                checked={showRomaji}
                onChange={(e) => setShowRomaji(e.target.checked)}
              />
              <span className="checkbox-text">ローマ字ガイドを表示する</span>
            </label>
          </div>

          <hr
            style={{
              borderColor: "rgba(255,255,255,0.2)",
              margin: "20px 0",
            }}
          />

          <div className={`config-item ${isMuted ? "disabled" : ""}`}>
            <div className="slider-label-row">
              <span>BGM音量</span>
              <span>{Math.round(bgmVol * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={bgmVol}
              onChange={(e) => setBgmVol(parseFloat(e.target.value))}
              disabled={isMuted}
              className="volume-slider"
            />
          </div>

          <div className={`config-item ${isMuted ? "disabled" : ""}`}>
            <div className="slider-label-row">
              <span>効果音(SE)音量</span>
              <span>{Math.round(seVol * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={seVol}
              onChange={(e) => setSeVol(parseFloat(e.target.value))}
              // ★ここを追加！指（マウス）を離した瞬間に音を鳴らす
              onMouseUp={() => {
                if (!isMuted) playDecisionSound();
              }}
              // ★スマホ（タッチ操作）対応もするならこれも追加
              onTouchEnd={() => {
                if (!isMuted) playDecisionSound();
              }}
              disabled={isMuted}
              className="volume-slider"
            />
          </div>

          <div className="config-buttons" style={{ marginTop: "30px" }}>
            <button className="pop-btn primary" onClick={onClose}>
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
