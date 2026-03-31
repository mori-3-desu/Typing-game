import { SoundBtn } from "../../common/SoundBtn";
import { type DifficultyLevel, type RankingScore } from "../../types";

type Props = {
  difficulty: DifficultyLevel;
  rankingData: RankingScore[];
  userId: string;
  isDevRankingMode: boolean;
  rankingDataMode: "global" | "dev" | null;
  isLoading: boolean;
  onClose: () => void;
  onShowDevScore: () => void;
  onFetchRanking: (diff?: DifficultyLevel) => void;
};

export const Ranking = ({
  difficulty,
  rankingData,
  userId,
  isDevRankingMode,
  rankingDataMode,
  isLoading,
  onClose,
  onShowDevScore,
  onFetchRanking,
}: Props) => {
  const expectedMode = isDevRankingMode ? "dev" : "global";
  const canShowRankingData = !isLoading && rankingDataMode === expectedMode;
  
  return (
    <div className="ranking-overlay" onClick={onClose}>
      <div
        className={`ranking-modal rank-theme-${difficulty.toLowerCase()}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* --- ヘッダー部分 (そのまま) --- */}
        <div className="ranking-header">
          <h2 className="ranking-title">
            {difficulty}{" "}
            <span style={{ fontSize: "0.4em", opacity: 0.8 }}>
              {isDevRankingMode ? "- 作成者のスコア -" : ""}
            </span>
          </h2>
          <div className="ranking-header-buttons">
            {!isDevRankingMode && (
              <SoundBtn
                className="close-btn dev-btn"
                onClick={onShowDevScore}
                title="製作者スコアを見る"
              >
                👑
              </SoundBtn>
            )}
            {isDevRankingMode && (
              <SoundBtn
                className="close-btn global-btn"
                onClick={() => { onFetchRanking(difficulty); }}
                title="全国ランキングに戻る"
              >
                🌏
              </SoundBtn>
            )}
            <SoundBtn className="close-btn" onClick={onClose} title="閉じる">
              ↩
            </SoundBtn>
          </div>
        </div>

        {/* --- リスト部分 --- */}
        <div className="ranking-list">
          {!canShowRankingData ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
            </div>
          ) : isDevRankingMode ? (
            rankingData.length > 0 ? (
              rankingData.map((item) => (
                <div key={item.id} className="dev-score-pop-container">
                  <div className="dev-score-card" style={{ color: "inherit" }}>
                    <SoundBtn
                      className="dev-pop-back-btn"
                      onClick={() => onFetchRanking(difficulty)}
                      title="ランキングに戻る"
                      style={{
                        position: "absolute",
                        top: "15px",
                        right: "15px",
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        border: "2px solid rgba(255,255,255,0.5)",
                        background: "rgba(0,0,0,0.3)",
                        color: "#fff",
                        fontSize: "1rem",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center"
                      }}
                    >
                      ↩
                    </SoundBtn>
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
                      <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                        {(() => {
                          const d = new Date(item.created_at);
                          return d.toLocaleString("ja-JP", {
                            timeZone: "Asia/Tokyo",
                            year: "numeric",
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        })()}
                      </span>
                    </div>
                    <div className="dev-main-score">
                      {item.score.toLocaleString()}
                    </div>
                    {/* 統計グリッド */}
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
              ))
            ) : (
              <div className="dev-score-pop-container">
                <p>Dev data not found...</p>
              </div>
            )
          ) : (
            // === 通常ランキング ===
            <>
              {rankingData.map((item, index) => {
                const rank = index + 1;
                const isMe = item.user_id === userId;
                const d = new Date(item.created_at);
                const dateStr = d.toLocaleString("ja-JP", {
                  timeZone: "Asia/Tokyo",
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={item.id}
                    className={`ranking-card rank-${rank} ${
                      isMe ? "my-rank" : ""
                    }`}
                    style={{ position: "relative" }}
                  >
                    {isMe && <div className="you-badge">YOU</div>}
                    <div className="rank-badge">
                      <span className="rank-num">{rank}</span>
                    </div>
                    <div className="rank-info">
                      <div className="rank-name-row">
                        <span className="rank-name">{item.name}</span>
                        <span className="rank-date">{dateStr}</span>
                      </div>
                      <div className="rank-score">
                        {item.score.toLocaleString()}
                      </div>
                      <div className="rank-stats-grid">
                        {/* 統計ボックス (省略せず記述) */}
                        <div className="stat-box c-green">
                          Correct: {item.correct}
                        </div>
                        <div className="stat-box c-red">Miss: {item.miss}</div>
                        <div className="stat-box c-blue">
                          BS: {item.backspace}
                        </div>
                        <div className="stat-box c-cyan">
                          Speed: {item.speed.toFixed(2)}
                        </div>
                        <div className="stat-box c-orange">
                          Combo: {item.combo}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {rankingData.length === 0 && (
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
