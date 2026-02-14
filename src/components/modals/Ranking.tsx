import { useState, useEffect } from "react";
import { type DifficultyLevel, type RankingScore } from "../../types";
import { DatabaseService } from "../../services/database";

type Props = {
  difficulty: DifficultyLevel;
  // rankingData はここで取得するので Props から削除
  userId: string;
  isDevRankingMode: boolean;
  onClose: () => void;
  onShowDevScore: () => void;
  onFetchRanking: (diff?: DifficultyLevel) => void;
};

export const Ranking = ({
  difficulty,
  userId,
  isDevRankingMode,
  onClose,
  onShowDevScore,
  onFetchRanking,
}: Props) => {
  // ★ 1. ここでデータを持つ
  const [rankingData, setRankingData] = useState<RankingScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ★ 2. データ取得ロジック (AbortController付き)
  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      setIsLoading(true);
      // setRankingData([]); // 画面をチラつかせたくないなら、ここはコメントアウトでもOK

      try {
        let data: RankingScore[] = [];

        // モード判定してAPIを呼び分け
        if (isDevRankingMode) {
          data = await DatabaseService.getDevScore(
            difficulty,
            controller.signal,
          );
        } else {
          data = await DatabaseService.getRanking(
            difficulty,
            controller.signal,
          );
        }

        // 通信が成功し、かつキャンセルされていなければセット
        if (!controller.signal.aborted) {
          setRankingData(data);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          if (err.name === "AbortError" || err.message === "Aborted") {
            return; // 何もせず終了
          }
          // 本当のエラーならログを出す
          console.error("APIエラー:", err.message);
          return;
        }
      } finally {
        // キャンセルされていない場合のみローディング終了
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    // ★ 3. クリーンアップ (タブ切り替えや閉じた時に通信キャンセル)
    return () => {
      controller.abort();
    };
  }, [difficulty, isDevRankingMode]); // 難易度かモードが変わるたびに発火

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
              <button
                className="close-btn dev-btn"
                onClick={onShowDevScore}
                title="製作者スコアを見る"
              >
                👑
              </button>
            )}
            {isDevRankingMode && (
              <button
                className="close-btn global-btn"
                onClick={() => onFetchRanking(difficulty)}
                title="全国ランキングに戻る"
              >
                🌏
              </button>
            )}
            <button className="close-btn" onClick={onClose} title="閉じる">
              ↩
            </button>
          </div>
        </div>

        {/* --- リスト部分 --- */}
        <div className="ranking-list">
          {/* ★ 4. ローディング表示 (シンプル版) */}
          {isLoading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                color: "#fff",
                fontSize: "1.2rem",
                opacity: 0.8,
              }}
            >
              Loading...
            </div>
          ) : (
            /* ロード完了後の表示 */
            <>
              {isDevRankingMode ? (
                // === 製作者スコア ===
                rankingData.length > 0 ? (
                  rankingData.map((item) => (
                    <div key={item.id} className="dev-score-pop-container">
                      <div
                        className="dev-score-card"
                        style={{ color: "inherit" }}
                      >
                        <button
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
                            fontSize: "1.2rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ↩
                        </button>
                        <div className="dev-label">CREATOR'S RECORD</div>
                        <div
                          className="rank-name-row"
                          style={{
                            justifyContent: "center",
                            gap: "10px",
                            marginBottom: "5px",
                          }}
                        >
                          <span style={{ fontSize: "1.2rem" }}>
                            👑 {item.name}
                          </span>
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
                          <div className="dev-stat-item">
                            <span style={{ color: "#4ade80" }}>Correct</span>
                            <span className="dev-stat-val">{item.correct}</span>
                          </div>
                          <div className="dev-stat-item">
                            <span style={{ color: "#f87171" }}>Miss</span>
                            <span className="dev-stat-val">{item.miss}</span>
                          </div>
                          <div className="dev-stat-item">
                            <span style={{ color: "#3498db" }}>BackSpace</span>
                            <span className="dev-stat-val">
                              {item.backspace}
                            </span>
                          </div>
                          <div className="dev-stat-item">
                            <span style={{ color: "#22d3ee" }}>Speed</span>
                            <span className="dev-stat-val">
                              {item.speed} <span>key/s</span>
                            </span>
                          </div>
                          <div className="dev-stat-item">
                            <span style={{ color: "#fbbf24" }}>MaxCombo</span>
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
                            <div className="stat-box c-red">
                              Miss: {item.miss}
                            </div>
                            <div className="stat-box c-blue">
                              BS: {item.backspace}
                            </div>
                            <div className="stat-box c-cyan">
                              Speed: {item.speed}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
