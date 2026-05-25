import { useState } from "react";

import { SoundBtn } from "../../../common/SoundBtn";
import { useImportMigrationCode } from "../hooks/useImportMigrationCode";
import { useIssueMigrationCode } from "../hooks/useIssueMigrationCode";
import { ImportSection } from "./ImportSection";
import { IssueSection } from "./IssueSection";

type Props = {
  onClose: () => void;
};

export const MigrationModal = ({ onClose }: Props) => {
  const issueHook = useIssueMigrationCode();
  const importHook = useImportMigrationCode();
  const [importInput, setImportInput] = useState("");

  const handleClose = () => {
    issueHook.reset();
    importHook.reset();
    setImportInput("");
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
        <div className="handoff-dialog scroll-gold">
          <IssueSection
            state={issueHook.state}
            copyFeedback={issueHook.copyFeedback}
            onIssue={issueHook.issue}
            onCopy={issueHook.copyToClipboard}
          />

          <ImportSection
            state={importHook.state}
            input={importInput}
            onChangeInput={setImportInput}
            onImport={() => importHook.importCode(importInput)}
          />
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
