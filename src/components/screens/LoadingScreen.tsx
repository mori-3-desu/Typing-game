import React from "react";

export const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="keyboard-loader">
        {["L", "O", "A", "D", "I", "N", "G"].map((char, i) => (
          <span
            key={i}
            className="key cat"
            // スマートに書けるが将来重くなったらCSSのnthプロパティ(ブラウザが計算が終わった状態で渡してくれるため爆速)を検討
            style={{ "--i": i } as React.CSSProperties}
          >
            {char}
          </span>
        ))}
      </div>
      <div className="loading-text">
        <span className="paw">🐾</span> Loading...{" "}
        <span className="paw">🐾</span>
      </div>
    </div>
  );
};
