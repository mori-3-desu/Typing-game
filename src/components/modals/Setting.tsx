import { Slider } from "../../common/Slider";
import { SoundBtn } from "../../common/SoundBtn";
import { useEscapekey } from "../../hooks/useEscapeKey";
import { playSE } from "../../utils/audio";
import { PlayerNameEditor } from "./PlayerNameEditor";

type Props = {
  playerName: string;
  isMuted: boolean;
  bgmVol: number;
  seVol: number;
  brightness: number;
  showRomaji: boolean;
  ngWordsList: string[];

  setIsMuted: (val: boolean) => void;
  setBgmVol: (val: number) => void;
  setSeVol: (val: number) => void;
  setBrightness: (val: number) => void;
  setShowRomaji: (val: boolean) => void;

  onSaveName: (newName: string) => void;
  onClose: () => void;
};

const handleCheckChange =
  (setter: (checked: boolean) => void) =>
  (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.currentTarget.checked);
  };

export const Setting = ({
  playerName,
  isMuted,
  bgmVol,
  seVol,
  brightness,
  showRomaji,
  ngWordsList,
  setIsMuted,
  setBgmVol,
  setSeVol,
  setBrightness,
  setShowRomaji,
  onSaveName,
  onClose,
}: Props) => {

  useEscapekey(onClose);
  return (
    <div className="config-overlay" onClick={onClose}>
      <div
        className="config-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="config-title" style={{ flexShrink: 0 }}>
          SETTING
        </h2>

        <div className="config-scroll-area scroll-gold">
          {/* 名前変更エリア */}
          <PlayerNameEditor
            playerName={playerName}
            ngWordsList={ngWordsList}
            onSaveName={onSaveName}
          />

          {/* その他設定項目 */}
          <div className="config-item">
            <label className="config-label">
              <input
                type="checkbox"
                checked={isMuted}
                onChange={handleCheckChange(setIsMuted)}
              />
              <span className="checkbox-text">音量をミュートにする</span>
            </label>
          </div>

          <div className="config-item">
            <label className="config-label">
              <input
                type="checkbox"
                checked={showRomaji}
                onChange={handleCheckChange(setShowRomaji)}
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

          <div className="config-item">
            <Slider
              label="明るさ調整"
              displayValue={`${Math.round(brightness * 100)}%`}
              min="0.5"
              max="1"
              step="0.1"
              value={brightness}
              onValueChange={setBrightness}
            />
          </div>

          <hr
            style={{
              borderColor: "rgba(255,255,255,0.2)",
              margin: "20px 0",
            }}
          />

          <div className={`config-item ${isMuted ? "disabled" : ""}`}>
            <Slider
              label="BGM音量"
              displayValue={`${Math.round(bgmVol * 100)}%`}
              min="0"
              max="1"
              step="0.05"
              value={bgmVol}
              onValueChange={setBgmVol}
              disabled={isMuted}
            />
          </div>

          <div className={`config-item ${isMuted ? "disabled" : ""}`}>
            <Slider
              label="効果音(SE)音量"
              displayValue={`${Math.round(seVol * 100)}%`}
              min="0"
              max="1"
              step="0.05"
              value={seVol}
              onValueChange={setSeVol}
              onPointerUp={() => {playSE("decision");
              }}
              disabled={isMuted}
            />
          </div>

          <div className="config-buttons" style={{ marginTop: "30px" }}>
            <SoundBtn className="pop-btn primary" onClick={onClose}>
              閉じる
            </SoundBtn>
          </div>
        </div>
      </div>
    </div>
  );
};
