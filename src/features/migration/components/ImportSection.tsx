import { useId, useState } from "react";

import { SoundBtn } from "../../../common/SoundBtn";
import type { ImportState } from "../types";

const CODE_LENGTH = 10;

type Props = {
  state: ImportState;
  input: string;
  onChangeInput: (value: string) => void;
  onImport: () => Promise<void>;
};

export const ImportSection = ({
  state,
  input,
  onChangeInput,
  onImport,
}: Props) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmTitleId = useId();

  const isLoading = state.status === "loading";
  const isInputComplete = input.length === CODE_LENGTH;

  const handleImportClick = async () => {
    setIsConfirming(true);
  };

  const handleConfirm = async () => {
    await onImport();
    setIsConfirming(false);
  };

  const handleCancel = () => {
    setIsConfirming(false);
  };

  if (isConfirming) {
    return (
      <section
        className="migration-section migration-confirm"
        role="alertdialog"
        aria-labelledby={confirmTitleId}
      >
        <h3
          id={confirmTitleId}
          style={{ color: "red", fontSize: "1.25rem", margin: 0 }}
        >
          本当に引き継ぎますか?
        </h3>
        <p style={{ margin: "0.5rem 0", color: "grey" }}>
          <strong style={{ color: "pink", fontSize: "1.5rem" }}>{input}</strong>{" "}
          を取り込みます。
        </p>
        <p style={{ color: "red", fontSize: "0.95rem", margin: "0.5rem 0" }}>
          現在の端末のデータは引継ぎ元のデータで上書きされ、
          <br />
          元に戻すことは出来ません。
        </p>

        <div className="migration-confirm-actions">
          <SoundBtn className="handoff-action" onClick={handleCancel}>
            いいえ
          </SoundBtn>
          <SoundBtn className="handoff-action danger" onClick={handleConfirm}>
            はい
          </SoundBtn>
        </div>
      </section>
    );
  }

  return (
    <section className="migration-section">
      <p style={{ color: "red", fontSize: "1rem" }}>
        ※引継ぎコードを入力すると、現在の端末のデータは
        <br />
        引継ぎ元のデータで上書きされます。元に戻すことは出来ません。
      </p>

      <label
        htmlFor="migration-import-code"
        style={{ display: "block", marginBottom: "0.25rem", color: "gray" }}
      >
        引継ぎコード({CODE_LENGTH}文字)
      </label>

      <div className="migration-field">
        <input
          id="migration-import-code"
          type="text"
          value={input}
          onChange={(e) => onChangeInput(e.target.value)}
          maxLength={CODE_LENGTH}
          placeholder="例：ABCDEF1234の英数字"
          autoComplete="off"
          spellCheck={false}
        />
        <SoundBtn
          className="handoff-action"
          onClick={handleImportClick}
          disabled={!isInputComplete || isLoading}
        >
          引継ぎ
        </SoundBtn>
      </div>

      <div className="message-container" style={{ minHeight: "1.5rem" }}>
        {state.status === "success" && (
          <p
            role="status"
            style={{ color: "green", fontSize: "1rem", margin: "0" }}
          >
            「{state.name}」のデータを取り込みました
          </p>
        )}
        {state.status === "error" && (
          <p
            role="alert"
            style={{ color: "red", fontSize: "1rem", margin: "0" }}
          >
            {state.message}
          </p>
        )}
      </div>
    </section>
  );
};
