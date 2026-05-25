import { SoundBtn } from "../../../common/SoundBtn";
import { formatJpDate } from "../../../utils/dateFormat";
import type { CopyFeedback, IssueState } from "../types";

type Props = {
  state: IssueState;
  copyFeedback: CopyFeedback | null;
  onIssue: () => Promise<void>;
  onCopy: () => Promise<void>;
};

export const IssueSection = ({
  state,
  copyFeedback,
  onIssue,
  onCopy,
}: Props) => {
  const isLoading = state.status === "loading";
  const hasCode = state.status === "success";

  return (
    <section className="migration-section">
      <p style={{ color: "red", fontSize: "1rem" }}>
        ※引き継ぎコードを発行し、移行先に入力して頂くことで
        <br />
        ゲームデータの引継ぎが出来ます。コード漏れなき用大切に保管してください。
      </p>

      <div className="migration-field">
        <p>引継ぎコード：{hasCode ? state.code : "(未発行)"}</p>
        <SoundBtn
          className="handoff-action"
          onClick={onIssue}
          disabled={isLoading}
        >
          発行
        </SoundBtn>
        <SoundBtn
          className="handoff-action"
          onClick={onCopy}
          disabled={!hasCode}
        >
          コピー
        </SoundBtn>
      </div>

      <div className="migration-field">
        <p>
          有効期限<span style={{ marginInlineStart: "32px" }}>：</span>
          {hasCode ? formatJpDate(state.expires_at) : "—"}
        </p>
      </div>

      <div className="message-container" style={{ minHeight: "1.5rem" }}>
        {state.status === "error" && (
          <p
            role="alert"
            style={{ color: "red", fontSize: "1rem", margin: "0" }}
          >
            {state.message}
          </p>
        )}
        {copyFeedback && (
          <p
            role={copyFeedback.kind === "error" ? "alert" : "status"}
            style={{
              color: copyFeedback.kind === "error" ? "red" : "green",
              fontSize: "1rem",
              margin: "0",
            }}
          >
            {copyFeedback.message}
          </p>
        )}
      </div>
    </section>
  );
};
