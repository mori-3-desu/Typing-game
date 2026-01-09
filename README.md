# 🌙 CRITICAL TYPING 🌙
![ゲームのデモ動画](./images/demo.gif)
**正確性×継続性を重視した実戦的かつ爽快感のあるポップなタイピングゲーム**

## 📖 概要 
「ミスタイプを改善し、実務で使えるタイピングスキルを身につける」ことを目的とした実践型タイピングゲームです。
既存のゲームにある「ミスしたら次の文字に進まない」仕様ではなく、**あえて「自分でBackSpace押して修正しないと次の単語に進めない」実戦的な仕様**を採用。
一方で、音ゲーの要素（スコア性、コンボシステムや演出）を取り入れることで、「爽快感」と「中毒性になる楽しさ」を追求しました。

## 🔗 URL
* **App**: [https://typing-game-eta-lime.vercel.app/]
* **Repository**: [https://github.com/mori-3-desu/Typing-game]

---

## 🎮 機能一覧 (Features)

### ⌨️ ゲームシステム (Game Logic)
* **実戦的な判定ロジック**:
    * 間違えた文字は赤字で残り続け、自分で **BackSpace** を押して消さない限り次の単語に進めません。
    * 「ミスタイプを自分で修正する」という、実務と同様のプロセスをゲーム化しました。
    *ミスタイプせずに単語を入力した際に、文字列ボーナスをスコアに加算することで正確性が重視されていることを体感できます。
* **爽快なコンボシステム**:
    * 正確に打ち続けることでコンボが加算され、コンボ数によって演出が追加されます。
    * コンボ継続によるタイムボーナスにより、正確性がスコアに直結します。
* **連打ゲージ**
    * 正確に打ち続けることで連打ゲージが加算されていき、MAXまで貯まるとタイムボーナスが加算されます。
    *ミスタイプすると大きく減少します。
* **入力分岐対応**:
    * ローマ字の多様な入力方式（ち：`ti`/`chi`、ん：`nn`/`n`など）に完全対応しています。

### 📊 画面構成
* **難易度選択**: 初心者から上級者まで楽しめるレベル設計。
    * 📄アイコンをクリックすることでハイスコア時のリザルト詳細を確認できます。
    * 王冠アイコンをクリックすることで全国ランキングを確認できます。
* **リザルト画面**: 
    * スコア、ミスタイプ、BackSpace、Speed、最大コンボ数を表示。
    * 苦手だったキーや単語を多い順に五つリストアップし、改善点を可視化します。
    * 以前のハイスコアとの差分を表示し、成長を実感できます。
    * スコアの値によってランクが決まります。
* **ランキング機能**: 
    * Supabase連携によるリアルタイムランキング。
    * 上位ランカーのスコアを目標にできます。
    * 開発者のスコアも表示できる機能を実装しましたので参考にしたり目標設定にしたりすることで、開発者とも競えるようにしています。

### ⚙️ 設定・その他
* **詳細設定**: BGM/SEの個別音量調整、ローマ字ガイドのON/OFF、プレイヤー名変更機能。
* **シェア機能**: ハイスコアをX（旧Twitter）でポストし、友人と競い合えます。

---

## 🛠️ 使用技術 (Tech Stack)

**Frontend**
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

**Backend / Infrastructure**
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white) ![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

**Testing / Tools**
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white) ![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white) ![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)

---

## 💡 技術選定とこだわり 

### Frontend: React × TypeScript
* **保守性と拡張性**: 最初はJavaScriptでフロントを作成し、状態管理と将来の機能拡張によるコードの複雑化が課題となり、保守性と拡張性を意識してReact × TypeScriptへ移行。
* **パフォーマンス最適化**:
    * `useRef`: Canvas描画やタイマー管理など、再レンダリングを避けるべき処理に活用し、Stateの自動管理の競合しないように使用を意識。
    * `useCallback`: ネットワーク通信など重い処理を適切なタイミングで実行。
    * `useState`: 遅延初期化を活用し、初期ロード時のコストを削減。
* **TypeScript**
   * コードを各段階で型を定義するため、エラーを検出しバグを削減できる。
   *将来機能拡張していく際、堅牢なコードとなり、品質や安全性を確保できる。

### Backend: Supabase (BaaS)
* **開発効率とセキュリティ**: 
    * PostgreSQLの勉強していたため、実際に扱ってみたかった。
    * 信頼性の高いツールに任せることによってバックエンド構築の工数を削減し、UI/UXの向上にリソースを集中。
    * **RLS (Row Level Security)** を設定し、データベース側でアクセス制御を行うことで、セキュアなランキングシステムを構築。
* **データの整合性**: PostgreSQLの厳格な型システムにより、バグの少ないデータ管理を実現しています。

### Build & Test: Vite / Vitest
* **高速な開発サイクル**: HMR（Hot Module Replacement）によるブラウザの即時反映で、開発の試行錯誤を効率的に。
* **品質保証**: Viteと相性が良いVitestによる単体テストを導入。将来的な機能追加やリファクタリング時にも既存ロジックを壊さないための品質を担保。

---

## 🎨 Credits & Special Thanks

**BGM**
* **しゃろう** 様 ("アトリエと電脳世界")
* **kyatto** 様 ("Secret-Adventure", "Stardust")

**効果音**
* 効果音ラボ 様
* 魔王魂 様
* Springin' 様

    ※記載漏れありましたら、ご連絡いただけると助かります🙇‍♂️

**Reference**
* 既存の素晴らしいタイピングゲームや音楽ゲームのUI/UXを参考に、独自のアレンジを加えて開発いたしました。もしよろしければ一度遊んでみてください！
フィードバックもお待ちしております！
