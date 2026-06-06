import { SoundBtn } from "../../common/SoundBtn";
import { useEscapekey } from "../../hooks/useEscapeKey";
import {
  type DifficultyLevel,
  type RankingEntry,
  type RankingScore,
  type RankingView,
} from "../../types";
import { formatJpDate } from "../../utils/dateFormat";

type Props = {
  difficulty: DifficultyLevel;
  rankingView: RankingView | null;
  mode: "global" | "dev";
  // 全国ランキングで自分のエントリを照合するための created_at（未送信時は null）。
  myCreatedAt: string | null;
  isLoading: boolean;
  onClose: () => void;
  onShowDevScore: () => void;
  onFetchRanking: (diff?: DifficultyLevel) => void;
};

// 開発者ランキング（API 経由）。RankingScore は id / user_id を持つ。
const DevRankingList = ({ entries }: { entries: RankingScore[] }) => {
  if (entries.length === 0) {
    return (
      <div className="dev-score-pop-container">
        <p>Dev data not found...</p>
      </div>
    );
  }

  return (
    <>
      {entries.map((item) => (
        <div key={item.id} className="dev-score-pop-container">
          <div className="dev-score-card" style={{ color: "inherit" }}>
            <div className="dev-label">CREATOR'S RECORD</div>
            <div
              className="rank-name-row"
              style={{
                justifyContent: "center",
                gap: "10px",
                marginTop: "5px",
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>👑 {item.name}</span>
              <span style={{ fontSize: "0.8rem" }}>
                {formatJpDate(item.created_at)}
              </span>
            </div>
            <div className="dev-main-score">{item.score.toLocaleString()}</div>
            <div className="dev-stats-grid">
              <div className="dev-stat-item stat-correct">
                <span>Correct</span>
                <span className="dev-stat-val">{item.correct}</span>
              </div>
              <div className="dev-stat-item stat-miss">
                <span>Miss</span>
                <span className="dev-stat-val">{item.miss}</span>
              </div>
              <div className="dev-stat-item stat-backspace">
                <span>BackSpace</span>
                <span className="dev-stat-val">{item.backspace}</span>
              </div>
              <div className="dev-stat-item stat-speed">
                <span>Speed</span>
                <span className="dev-stat-val">
                  {item.speed.toFixed(2)} <span>key/s</span>
                </span>
              </div>
              <div className="dev-stat-item stat-combo">
                <span>MaxCombo</span>
                <span className="dev-stat-val">{item.combo}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

type GlobalRankingListProps = {
  entries: RankingEntry[];
  myCreatedAt: string | null;
};

// 全国ランキング（S3 配信）。RankingEntry は個人識別子を持たないため、
// 自分のエントリは created_at の一致で判別する（key も created_at を使う）。
const GlobalRankingList = ({
  entries,
  myCreatedAt,
}: GlobalRankingListProps) => {
  if (entries.length === 0) {
    return (
      <div
        style={{
          fontSize: "2.5em",
          textAlign: "center",
          padding: "150px",
          color: "gray",
        }}
      >
        No scores registered yet.
      </div>
    );
  }

  return (
    <>
      {entries.map((item, index) => {
        const rank = index + 1;
        const isMe = myCreatedAt !== null && item.created_at === myCreatedAt;

        return (
          <div
            key={item.created_at}
            className={`ranking-card rank-${rank} ${isMe ? "my-rank" : ""}`}
            style={{ position: "relative" }}
          >
            {isMe && <div className="you-badge">YOU</div>}
            <div className="rank-badge">
              <span className="rank-num">{rank}</span>
            </div>
            <div className="rank-info">
              <div className="rank-name-row">
                <span className="rank-name">{item.name}</span>
                <span className="rank-date">
                  {formatJpDate(item.created_at)}
                </span>
              </div>
              <div className="rank-score">{item.score.toLocaleString()}</div>
              <div className="rank-stats-grid">
                <div className="stat-box c-green">Correct: {item.correct}</div>
                <div className="stat-box c-red">Miss: {item.miss}</div>
                <div className="stat-box c-blue">BS: {item.backspace}</div>
                <div className="stat-box c-cyan">
                  Speed: {item.speed.toFixed(2)}
                </div>
                <div className="stat-box c-orange">Combo: {item.combo}</div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};

export const Ranking = ({
  difficulty,
  rankingView,
  mode,
  myCreatedAt,
  isLoading,
  onClose,
  onShowDevScore,
  onFetchRanking,
}: Props) => {
  const isDev = mode === "dev";
  const btnIcon = isDev ? "🌏" : "👑";
  const devText = isDev
    ? "- 作成者のスコア -"
    : "ランキングは15分ごとに反映されます。";
  const btnLabel = isDev ? "全国ランキングに戻る" : "開発者のスコアを表示する";
  // canShow が true のとき rankingView は非 null（TS の別名条件ナローイング）。
  const canShow = !isLoading && rankingView !== null;

  const handleToggle: React.MouseEventHandler<HTMLButtonElement> = () =>
    isDev ? onFetchRanking(difficulty) : onShowDevScore();

  useEscapekey(onClose);
  return (
    <div className="ranking-overlay" onClick={onClose}>
      <div
        className={`ranking-modal rank-theme-${difficulty.toLowerCase()}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ranking-header">
          <h2 id="modal-title" className="ranking-title">
            {difficulty} <span style={{ fontSize: "0.23em" }}>{devText}</span>
          </h2>

          <div className="ranking-header-buttons">
            <SoundBtn
              className="close-btn dev-btn"
              onClick={handleToggle}
              title={btnLabel}
              aria-label={btnLabel}
            >
              {btnIcon}
            </SoundBtn>
            <SoundBtn className="close-btn" onClick={onClose} title="閉じる">
              ↩
            </SoundBtn>
          </div>
        </div>

        <div className="ranking-list">
          {!canShow && (
            <div className="loading-container">
              <div className="loading-spinner" role="status"></div>
            </div>
          )}
          {canShow && rankingView.mode === "dev" && (
            <DevRankingList entries={rankingView.entries} />
          )}
          {canShow && rankingView.mode === "global" && (
            <GlobalRankingList
              entries={rankingView.entries}
              myCreatedAt={myCreatedAt}
            />
          )}
        </div>
      </div>
    </div>
  );
};
