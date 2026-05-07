import { SoundBtn } from "../../../common/SoundBtn";
import { useHandoffCode } from "../hooks/useHandoffCode";

type Props = {
  onClose: () => void;
};

export const HandoffModal = ({ onClose }: Props) => {
  const { code, error, successCopied, generateCode, copyToClipboard, reset } =
    useHandoffCode();

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="config-overlay" onClick={handleClose}>
      <div
        className="handoff-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="handoff-title">
          引継ぎ設定
        </h2>

        {/* REMOVE_AFTER: 2026-MM-DD */}
        <div className="handoff-dialog">
          <p style={{ color: "red", fontSize: "1rem" }}>
            ※引き継ぎコードを発行し、移行先に入力して頂くことで
            <br />
            ゲームデータの引継ぎが出来ます。コード漏れなき用大切に保管してください。
          </p>

          <textarea
            className="handoff-code"
            readOnly
            aria-label="引継ぎコード"
            placeholder="「発行」を押すとコードがここに表示されます"
            value={code}
          />
          <div
            className="message-container"
            style={{ minHeight: "1.5rem"}}
          >
            {successCopied && (
              <p role="status" style={{ color: "green", fontSize: "1rem", margin: "0"}}>
                {successCopied}
              </p>
            )}
            {error && (
              <p role="alert" style={{ color: "red", fontSize: "1rem", margin: "0"}}>
                {error}
              </p>
            )}
          </div>

          <div className="handoff-actions">
            <SoundBtn className="handoff-action" onClick={generateCode}>
              発行
            </SoundBtn>
            <SoundBtn
              className="handoff-action"
              onClick={copyToClipboard}
              disabled={!code}
            >
              コピー
            </SoundBtn>
          </div>
        </div>

        <div className="handoff-close">
          <SoundBtn className="handoff-close primary" onClick={handleClose}>
            閉じる
          </SoundBtn>
        </div>
      </div>
    </div>
  );
};
