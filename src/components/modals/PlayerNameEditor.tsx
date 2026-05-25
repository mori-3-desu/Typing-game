import { useEffect, useId, useRef, useState } from "react";

import { SoundBtn } from "../../common/SoundBtn";
import { PLAYER_NAME_CHARS, UI_TIMINGS } from "../../utils/constants";

type Props = {
  playerName: string;
  onSaveName: (newName: string) => Promise<void>;
};

// 長さ・空文字のみクライアントで即時チェック。NGワード判定はサーバー(PATCH)に任せる。
const validateName = (name: string): string | null => {
  if (!name) {
    return "名前を入力してください";
  }

  if (name.length > PLAYER_NAME_CHARS.MAX) {
    return `名前は${PLAYER_NAME_CHARS.MAX}文字以内で入力してください`;
  }

  return null;
};

export const PlayerNameEditor = ({ playerName, onSaveName }: Props) => {
  const [tempPlayerName, setTempPlayerName] = useState(playerName);
  const [nameError, setNameError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const coolDownTimerRef = useRef<number | null>(null);
  const isNameChangeRef = useRef(false);
  const nameInputId = useId();

  useEffect(() => {
    return () => {
      if (coolDownTimerRef.current) {
        clearTimeout(coolDownTimerRef.current);
      }
    };
  }, []);

  const handleTempNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempPlayerName(e.currentTarget.value);
    if (nameError) setNameError("");
  };

  const clearTimer = () => {
    if (coolDownTimerRef.current) {
      clearTimeout(coolDownTimerRef.current);
      coolDownTimerRef.current = null;
    }
    isNameChangeRef.current = false;
  };

  const nameChangeError = (message: string) => {
    setNameError(message);

    coolDownTimerRef.current = window.setTimeout(() => {
      setNameError("");
      clearTimer();
    }, UI_TIMINGS.MESSAGE_AUTO_CLOSE);
  };

  // 検証付き mutation は onSaveName(PATCH /api/scores/name)に集約。
  // NG ワード等で失敗したら throw されるので、その message を表示する。
  const handleNameChange = async () => {
    if (isNameChangeRef.current) return;
    isNameChangeRef.current = true;

    const trimmedName = tempPlayerName.trim();
    const errorMessage = validateName(trimmedName);
    if (errorMessage) {
      // エラー時はすぐ再操作できるようフラグを戻す
      isNameChangeRef.current = false;
      nameChangeError(errorMessage);
      return;
    }

    try {
      await onSaveName(trimmedName);
    } catch (error: unknown) {
      isNameChangeRef.current = false;
      nameChangeError(
        error instanceof Error ? error.message : "名前を変更できませんでした",
      );
      return;
    }

    setSavedMessage("名前を保存しました！");
    coolDownTimerRef.current = window.setTimeout(() => {
      setSavedMessage("");
      clearTimer();
    }, UI_TIMINGS.MESSAGE_AUTO_CLOSE);
  };

  return (
    <>
      <div className="config-item">
        <label
          htmlFor={nameInputId}
          style={{
            display: "flex",
            cursor: "pointer",
            marginBottom: "5px",
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

        <div
          style={{
            display: "flex",
            gap: "20px",
            alignItems: "center",
          }}
        >
          <input
            id={nameInputId}
            type="text"
            className={`pop-input-field ${nameError ? "input-error-shake" : ""}`}
            value={tempPlayerName}
            maxLength={PLAYER_NAME_CHARS.MAX}
            onChange={handleTempNameChange}
            placeholder="Guest"
            style={{
              flex: 1,
              margin: 0,
              fontSize: "18px",
              textAlign: "left",
              transition: "all 0.3s",
            }}
          />
          <SoundBtn
            className="btn-change-name"
            onClick={handleNameChange}
            style={{
              whiteSpace: "nowrap",
              padding: "10px 20px",
              fontSize: "0.9rem",
              height: "46px",
            }}
          >
            変更
          </SoundBtn>
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
          {/* ここ優先度はさげるがネストで見づらいため見直す */}
          {nameError ? (
            <p
              className="error-fade-in"
              role="alert"
              aria-live="assertive"
              style={{
                fontSize: "0.85rem",
                margin: 0,
                color: "#ff4d4d",
              }}
            >
              {nameError}
            </p>
          ) : savedMessage ? (
            <p
              className="fade-in"
              aria-live="polite"
              style={{
                fontSize: "0.85rem",
                margin: 0,
                color: "#4dff88",
              }}
            >
              ✓ {savedMessage}
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
    </>
  );
};
