import { useCallback, useRef } from "react";

import { playSE } from "../utils/audio";

type SoundBtnProps = React.ComponentProps<"button"> & {
  SoundType?: "decision";
};

// 連続クリックを防止する処理
// 現状ここ以外使わないが他にも連続クリック防止したい箇所があったら
// この処理を別フォルダに切り分ける
const isThrottled = (lastTime: number, delay: number) => {
  return performance.now() - lastTime < delay;
};

// 先にplaySEを鳴らしてるのは押した時の体感速度を上げる為
// コンポーネント側からはonclickの中身は予測できないため、重い処理が入っていると
// 鳴るのが遅れてUXが下がる
// onClickの比較は関数がちゃんと届いてたら実行させるガード
// これが無いと音だけ鳴らすボタンで意図的にonclickを置かず、
// SoundBtnコンポーネントを使うとエラーでクラッシュする
export const SoundBtn = ({
  children,
  onClick,
  SoundType = "decision",
  ...props
}: SoundBtnProps) => {
  const lastClickTime = useRef(0);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isThrottled(lastClickTime.current, 300)) return;

      lastClickTime.current = performance.now();
      playSE(SoundType);
      onClick?.(e);
    },
    [onClick, SoundType],
  );

  return (
    <button {...props} onClick={handleClick}>
      {children}
    </button>
  );
};
