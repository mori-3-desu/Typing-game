import {
  type DifficultyLevel,
  type GameResultStats,
  type WeakWord,
} from "../../types";
import { LIMIT_DATA } from "../../utils/setting";

type Props = {
  gameState: "result" | "hiscore_review";
  difficulty: DifficultyLevel;

  // ★重要: 親(App.tsx)が決めた「表示すべきデータ」を1つだけ受け取る
  resultData: GameResultStats;

  highScore?: number;
  scoreDiff: number;
  isNewRecord: boolean;
  resultAnimStep: number;

  // アクション（ボタン押下時の処理）
  onRetry: () => void;
  onBackToDifficulty: () => void;
  onBackToTitle: () => void;
  onShowRanking: () => void;
  onTweet: () => string;
  onClickScreen: () => void;
};

export const ResultScreen = ({
  gameState,
  difficulty,
  resultData, // <--- これを使います
  highScore,
  scoreDiff,
  isNewRecord,
  resultAnimStep,
  onRetry,
  onBackToDifficulty,
  onBackToTitle,
  onShowRanking,
  onTweet,
  onClickScreen,
}: Props) => {
  // App.tsx から渡されたデータをそのままターゲットにする
  const targetResultData = resultData;

  // 苦手単語リスト (既に整形済みだが念のため型定義通りに使用)
  const displayWeakWords = targetResultData.weakWords;

  // 苦手キー (オブジェクト形式なので、配列に変換してソート)
  const displayWeakKeys = Object.entries(targetResultData.weakKeys)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT_DATA.WEAK_DATA_LIMIT);

  let diffClass = "diff-zero";
  if (scoreDiff > 0) diffClass = "diff-plus";
  if (scoreDiff < 0) diffClass = "diff-minus";

  return (
    <div
      id="result-screen"
      className={`res-theme-${difficulty.toLowerCase()}`}
      onClick={onClickScreen}
      style={{ opacity: 1, zIndex: 20 }}
    >
      <h2 className="result-title">RESULT</h2>

      <div className="result-grid">
        <div className="result-left-col">
          {/* アニメーション1: スコア */}
          <div
            className={`score-big-container fade-target ${
              resultAnimStep >= 1 ? "visible" : ""
            }`}
            id="res-anim-1"
          >
            <div className="score-header-row">
              <div className="score-label-main">SCORE</div>

              {/* ▼ 修正: highScore がある時（通常リザルト）だけ、このブロックごと表示する */}
              {highScore !== undefined && (
                <div className="hiscore-block">
                  {/* NEW RECORDバッジ */}
                  <div
                    id="new-record-badge"
                    className={
                      isNewRecord && gameState === "result" ? "" : "hidden"
                    }
                  >
                    NEW RECORD!
                  </div>

                  {/* ハイスコア行 */}
                  <div className="hiscore-row">
                    <span className="hiscore-label">HI-SCORE</span>
                    <span className="hiscore-value" id="res-hi-score">
                      {highScore.toLocaleString()}
                    </span>
                  </div>

                  {/* スコア差分 */}
                  {gameState === "result" && (
                    <div className={`score-diff ${diffClass}`} id="score-diff">
                      {scoreDiff > 0 ? "+" : scoreDiff === 0 ? "±" : ""}
                      {scoreDiff.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
              {/* ▲ 条件分岐ここまで */}
            </div>

            <div className="score-main-row">
              <div
                className="score-val-huge"
                id="res-score"
                style={{ textAlign: "right" }}
              >
                {targetResultData.score.toLocaleString()}
              </div>
            </div>
          </div>

          {/* アニメーション2: 判定数などのスタッツ */}
          <div
            className={`stats-compact-container fade-target ${
              resultAnimStep >= 2 ? "visible" : ""
            }`}
            id="res-anim-2"
          >
            <div className="stat-row">
              <span className="stat-label c-green">Correct</span>
              <div className="stat-right-stacked">
                <span className="sub-val-upper">
                  ({targetResultData.words} words)
                </span>
                <span className="stat-val c-green" id="res-correct">
                  {targetResultData.correct}
                </span>
              </div>
            </div>
            <div className="stat-row">
              <span className="stat-label c-red">Miss</span>
              <div className="stat-right">
                <span className="stat-val c-red" id="res-miss">
                  {targetResultData.miss}
                </span>
              </div>
            </div>
            <div className="stat-row">
              <span className="stat-label c-blue">BackSpace</span>
              <div className="stat-right">
                <span className="stat-val c-blue" id="res-bs">
                  {targetResultData.backspace}
                </span>
              </div>
            </div>
            <div className="stat-row">
              <span className="stat-label c-cyan">Speed</span>
              <div className="stat-val-group" style={{ textAlign: "right" }}>
                <span className="stat-val c-cyan" id="res-speed">
                  {targetResultData.speed}
                </span>
                <span className="stat-unit">key/s</span>
              </div>
            </div>
            <div className="stat-row combo-row">
              <span className="stat-label c-orange">MAX COMBO</span>
              <span className="stat-val c-orange" id="res-max-combo">
                {targetResultData.combo}
              </span>
            </div>
          </div>
        </div>

        <div className="col-right">
          {/* アニメーション3: 苦手単語 */}
          <div
            className={`result-box weak-box fade-target ${
              resultAnimStep >= 3 ? "visible" : ""
            }`}
            id="res-anim-3"
          >
            <div className="label-small">苦手な単語</div>
            <ul id="weak-words-list" className="weak-list scroll-gold">
              {displayWeakWords.map((item: WeakWord, idx: number) => (
                <li key={idx}>
                  <span className="weak-text" title={item.word}>
                    {item.word}
                  </span>{" "}
                  <span className="miss-count">{item.misses}ミス</span>
                </li>
              ))}
              {displayWeakWords.length === 0 && <li>None</li>}
            </ul>
          </div>

          {/* アニメーション4: 苦手キー */}
          <div
            className={`result-box weak-box fade-target ${
              resultAnimStep >= 3 ? "visible" : ""
            }`}
            id="res-anim-4"
          >
            <div className="label-small">苦手なキー</div>
            <ul
              id="weak-keys-list"
              className="weak-list scroll-gold"
              style={{ display: "flex", flexDirection: "column" }}
            >
              {displayWeakKeys.map(([char, count], idx) => (
                <li key={idx}>
                  <span>{char.toUpperCase()}</span>{" "}
                  <span className="miss-count">{count}回</span>
                </li>
              ))}
              {displayWeakKeys.length === 0 && <li>None</li>}
            </ul>
          </div>

          {/* アニメーション5: ランク */}
          <div
            className={`rank-area fade-target ${
              resultAnimStep >= 4 ? "visible" : ""
            }`}
            id="res-anim-5"
          >
            <div className="rank-circle">
              <div className="rank-label">RANK</div>
              <div
                id="res-rank"
                className={`rank-char res-rank-${targetResultData.rank.toLowerCase()}`}
              >
                {targetResultData.rank}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* アニメーション6: フッターボタン */}
      <div
        className={`result-footer-area fade-target ${
          resultAnimStep >= 5 ? "visible" : ""
        }`}
        id="res-anim-6"
      >
        {gameState === "result" ? (
          <>
            <div className="result-buttons">
              <button
                id="btn-retry"
                className="res-btn primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
              >
                もう一度 (Enter)
              </button>
              <button
                id="btn-Esc-to-difficulty"
                className="res-btn secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onBackToDifficulty();
                }}
              >
                難易度選択へ (Esc)
              </button>
              <button
                id="btn-back-to-title"
                className="res-btn secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onBackToTitle();
                }}
              >
                タイトルへ
              </button>
            </div>
            <div className="result-share-group">
              <div
                className="share-icon-box crown-box"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowRanking();
                }}
              >
                <img src="/images/ranking.png" alt="Ranking" />
              </div>
              <a
                href={onTweet()}
                target="_blank"
                rel="noopener noreferrer"
                id="btn-share-x"
                className="share-icon-box x-box"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src="/images/X.jpg"
                  alt="Share on X"
                  style={{
                    width: "30px",
                    height: "30px",
                    objectFit: "contain",
                  }}
                />
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="result-buttons"></div>
            <div
              className="result-share-group"
              style={{ position: "absolute", right: "10px" }}
            >
              <button
                className="share-icon-box"
                onClick={(e) => {
                  e.stopPropagation();
                  onBackToDifficulty();
                }}
                style={{
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.2)",
                  border: "2px solid #fff",
                  color: "#fff",
                  borderRadius: "50%",
                  width: "50px",
                  height: "50px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "1.6rem",
                  fontWeight: "bold",
                }}
              >
                ↩
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
