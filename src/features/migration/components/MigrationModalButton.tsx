import { SoundBtn } from "../../../common/SoundBtn";

type Props = {
  onClick: () => void;
};

export const MigrationModalButton = ({ onClick }: Props) => {
  return (
    <>
      {/* 引継ぎ機能 */}
      <div>
        <SoundBtn
          className="handoff-button"
          aria-label="引き継ぎ設定"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <span className="hamburger-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </SoundBtn>
      </div>
    </>
  );
};
