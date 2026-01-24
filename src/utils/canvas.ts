// ==========================================
// 🎨 デザイン・レイアウト設定 (File-level Constants)
// ==========================================

const READY_DESIGN = {
  // キャッシュ(金型)のサイズ
  CACHE_HEIGHT: 300,

  // キャッシュ内での描画位置 (Y座標)
  POS_ENTER_Y: 125,
  POS_ESC_Y:   180,

  // メイン画面描画時のオフセット
  STATIC_OFFSET_Y: 500, // 固定テキストの開始位置 (readyY + 500)
  BLINK_OFFSET_Y:  550, // 点滅テキストの位置 (readyY + 550)

  // アニメーション設定
  BLINK_SPEED: 220,   // 点滅スピード (小さいほど速い)
} as const;

const GO_DESIGN = {
  FONT_SIZE: 270,
  GRADIENT_RANGE: 60, // グラデーションの幅 (-60 ~ +60)
  STROKE_WIDTH_OUTER: 25,
  STROKE_WIDTH_INNER: 4,
} as const;


// ==========================================
// 🏭 キャッシュ生成 (Factory)
// ==========================================

// Ready画面のテキストを保持するキャッシュ
let readyStaticTextCache: HTMLCanvasElement | null = null;
let lastCachedWidth = 0; // リサイズ検知用

// GO!のグラデーションキャッシュ
const GO_GRADIENT_CACHE: { grad: CanvasGradient | null } = { grad: null };

/**
 * 点滅しない固定テキストをキャッシュ化する
 */
const prepareReadyStaticTextCache = (width: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = READY_DESIGN.CACHE_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  
  ctx.textAlign = "center";
  ctx.lineJoin = "round";

  // --- 1. Enterで開始 ---
  ctx.font = "800 55px 'M PLUS Rounded 1c', sans-serif";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "white";
  ctx.strokeText("Enter or Space で開始", width / 2, READY_DESIGN.POS_ENTER_Y);
  
  const grad = ctx.createLinearGradient(0, READY_DESIGN.POS_ENTER_Y - 35, 0, READY_DESIGN.POS_ENTER_Y + 10);
  grad.addColorStop(0, "#ffc2ffff");
  grad.addColorStop(1, "#dfbdffff");
  ctx.fillStyle = grad;
  ctx.fillText("Enter or Space で開始", width / 2, READY_DESIGN.POS_ENTER_Y);

  // --- 2. Escで戻る ---
  ctx.font = "800 32px 'M PLUS Rounded 1c', sans-serif";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "white";
  ctx.strokeText("Esc で難易度選択へ", width / 2, READY_DESIGN.POS_ESC_Y);
  ctx.fillStyle = "#9deff2";
  ctx.fillText("Esc で難易度選択へ", width / 2, READY_DESIGN.POS_ESC_Y);

  return canvas;
};

// ==========================================
// 🖌️ メイン描画関数 (Renderer)
// ==========================================

export const drawReadyAnimation = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  readyY: number,
  readyImage: HTMLImageElement | null,
  showEnterText: boolean
) => {
  ctx.clearRect(0, 0, width, height);

  // 背景画像
  if (readyImage) {
    ctx.drawImage(readyImage, 0, readyY, width, height);
  }

  if (showEnterText) {
    // 1. キャッシュチェック (存在確認 & リサイズ確認)
    if (!readyStaticTextCache || lastCachedWidth !== width) {
       readyStaticTextCache = prepareReadyStaticTextCache(width);
       lastCachedWidth = width;
    }
    
    // 2. 固定パーツ描画 (キャッシュ貼り付け)
    ctx.drawImage(readyStaticTextCache, 0, readyY + READY_DESIGN.STATIC_OFFSET_Y);

    // 3. 点滅パーツ描画 (ここだけ動的計算)
    const blinkAlpha = (Math.sin(Date.now() / READY_DESIGN.BLINK_SPEED) + 1) / 2;

    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.font = "800 35px 'M PLUS Rounded 1c', sans-serif";
    
    // 枠線
    ctx.lineWidth = 6;
    ctx.strokeStyle = `rgba(255, 255, 255, ${blinkAlpha})`;
    ctx.strokeText(
      "※遊ぶ際にはキーボードを使います！",
      width / 2,
      readyY + READY_DESIGN.BLINK_OFFSET_Y
    );
    
    // 中身
    ctx.fillStyle = `rgba(255, 0, 0, ${blinkAlpha})`;
    ctx.fillText(
      "※遊ぶ際にはキーボードを使います！", 
      width / 2, 
      readyY + READY_DESIGN.BLINK_OFFSET_Y
    );
  }
};

export const drawGoAnimation = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number
) => {
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  
  ctx.font = `${GO_DESIGN.FONT_SIZE}px 'Fredoka One', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  // 白フチ
  ctx.lineWidth = GO_DESIGN.STROKE_WIDTH_OUTER;
  ctx.strokeStyle = "white";
  ctx.strokeText("GO!", 0, 0);

  // グラデーション (キャッシュ利用)
  if (!GO_GRADIENT_CACHE.grad) {
    const r = GO_DESIGN.GRADIENT_RANGE;
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, "#FFEA00");
    g.addColorStop(0.5, "#FF0099");
    g.addColorStop(1, "#00E5FF");
    GO_GRADIENT_CACHE.grad = g;
  }
  ctx.fillStyle = GO_GRADIENT_CACHE.grad;
  ctx.fillText("GO!", 0, 0);

  // ハイライト
  ctx.lineWidth = GO_DESIGN.STROKE_WIDTH_INNER;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.strokeText("GO!", 0, 0);

  ctx.restore();
};