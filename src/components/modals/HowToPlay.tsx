import type { FC } from "react";

import { SoundBtn } from "../../common/SoundBtn";

type Props = {
  onClose: () => void;
};

const KEY_GUIDE_DATA = [
  { char: "し", val: "si / shi" },
  { char: "つ", val: "tu / tsu" },
  { char: "ち", val: "ti / chi" },
  { char: "ん", val: "n / nn" },
];

export const HowToPlay: FC<Props> = ({ onClose }) => {
  return (
    <div className="config-overlay" onClick={onClose}>
      <div
        className="config-modal how-to-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="config-title">
          遊び方
        </h2>

        <div className="howto-grid-container">
          <div className="howto-col left-col">
            <h3 className="howto-heading">ルール</h3>
            <ul className="howto-list">
              <li>
                <span className="icon">⏰</span>
                <span>
                  難易度ごとに
                  <span className="highlight-gold">制限時間</span>
                  があります。
                </span>
              </li>
              <li>
                <span className="icon">🌟</span>
                <span>
                  ミスタイプなく単語入力すると
                  <span className="highlight-gold">ボーナス得点</span>GET！
                  <br />
                  <span className="note red-note">
                    ※1回でもミスタイプすると加算されません
                  </span>
                </span>
              </li>
              <li>
                <span className="icon">↩️</span>
                <span>
                  ミスタイプは
                  <span className="highlight-blue">BackSpace</span>
                  で消す必要があります。
                  <br />
                  正しく打てた場合は
                  <span className="highlight-green">緑</span>
                  に、ミスタイプした場合は
                  <span className="highlight-red">赤</span>で表示されます。
                  <br />
                  <span className="note red-note">
                    ※赤くなってもキー入力は進みますが次の単語には進めません！修正はめんどくさいですよ！
                  </span>
                </span>
              </li>
              <li>
                <span className="icon">🔋</span>
                <span>
                  <span className="highlight-green">連打ゲージ</span>
                  ：正解で増加！ミスで減少...！満タンになるとタイム加算！
                </span>
              </li>
              <li>
                <span className="icon">🌈</span>
                <span>
                  正確に打ち続けると
                  <span className="highlight-gold">COMBO</span>
                  増加！コンボ数に応じてタイムも増加！
                </span>
              </li>
              <li>
                <span className="icon">🔥</span>
                <span>
                  ミスタイプでコンボ終了。スコアを伸ばして
                  <span className="highlight-gold">全国ランキング</span>
                  を目指そう！
                </span>
              </li>
            </ul>
          </div>

          <div className="howto-col right-col">
            <h3 className="howto-heading">操作方法</h3>
            <div className="howto-section">
              <p className="howto-text">
                中央に表示されている単語をタイピング！
                <span className="highlight-green">EASY</span>・
                <span className="highlight-blue">NORMAL</span>・
                <span className="highlight-gold">HARD</span>・
                <span className="highlight-red">EXTRA</span>
                <br />
                3つの難易度があり、出題傾向が変わります。
                お好きな難易度で挑戦してください！
              </p>
            </div>
            <div className="howto-section">
              <h3 className="howto-heading-sub">ローマ字対応</h3>
              <p className="howto-text">様々な入力分岐に対応しています。</p>
              <div className="key-example-box">
                {KEY_GUIDE_DATA.map((item) => (
                  <div className="key-row" key={item.char}>
                    <span className="key-char">{item.char}</span>
                    <span className="key-val">{item.val}</span>
                  </div>
                )
                )}
                <p className="warning">
                  ※母音の前や末尾は <span className="highlight-gold">nn</span>{" "}
                  必須
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="config-buttons">
          <SoundBtn className="pop-btn primary" onClick={onClose}>
            閉じる
          </SoundBtn>
        </div>
      </div>
    </div>
  );
};
