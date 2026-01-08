// Ready画面の描画 (降下アニメーション)
export const drawReadyAnimation = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  readyY: number,
  readyImage: HTMLImageElement | null,
  showEnterText: boolean
) => {
  ctx.clearRect(0, 0, width, height); // ※重要 キャンバスを掃除して綺麗にする(これがないと残像アニメーションに)

  // 画像の描画
  if (readyImage) {
    ctx.drawImage(readyImage, 0, readyY, width, height); //キャンバスを描く
  }

  // テキストの描画
  if (showEnterText) {
    ctx.textAlign = "center";

    // 点滅演出
    const blinkAlpha = (Math.sin(Date.now() / 220) + 1) / 2;

    // 注意書き
    ctx.font = "800 35px 'M PLUS Rounded 1c', sans-serif";
    ctx.lineJoin = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = `rgba(255, 255, 255, ${blinkAlpha})`;
    ctx.strokeText(
      "※遊ぶ際にはキーボードを使います！",
      width / 2,
      readyY + 550
    );
    ctx.fillStyle = `rgba(255, 0, 0, ${blinkAlpha})`;
    ctx.fillText("※遊ぶ際にはキーボードを使います！", width / 2, readyY + 550);

    // Enterで開始
    ctx.font = "800 55px 'M PLUS Rounded 1c', sans-serif";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "white";
    ctx.strokeText("Enter で開始", width / 2, readyY + 625);

    // グラデーション
    let grad = ctx.createLinearGradient(0, readyY + 590, 0, readyY + 635);
    grad.addColorStop(0, "#ffc2ffff");
    grad.addColorStop(1, "#dfbdffff");
    ctx.fillStyle = grad;
    ctx.fillText("Enter で開始", width / 2, readyY + 625);

    // Escで戻る
    ctx.font = "800 32px 'M PLUS Rounded 1c', sans-serif";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "white";
    ctx.strokeText("Esc で難易度選択へ", width / 2, readyY + 680);
    ctx.fillStyle = "#9deff2";
    ctx.fillText("Esc で難易度選択へ", width / 2, readyY + 680);
  }
};

// GO!アニメーションの描画
export const drawGoAnimation = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number
) => {
  ctx.clearRect(0, 0, width, height);

  ctx.save(); // 今の状態を覚えておく
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "250px 'Fredoka One', sans-serif";
  ctx.lineJoin = "round";

  // 極太の白いフチ
  ctx.lineWidth = 25;
  ctx.strokeStyle = "white";
  ctx.strokeText("GO!", 0, 0);

  // 3色グラデーション
  const gradient = ctx.createLinearGradient(0, -60, 0, 60);
  gradient.addColorStop(0, "#FFEA00");
  gradient.addColorStop(0.5, "#FF0099");
  gradient.addColorStop(1, "#00E5FF");

  ctx.fillStyle = gradient;
  ctx.fillText("GO!", 0, 0);

  // 内側のハイライト
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.strokeText("GO!", 0, 0);

  ctx.restore(); // saveの状態に戻す
};
