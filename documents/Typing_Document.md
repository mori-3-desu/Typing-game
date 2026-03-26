# --- CRITICAL_TYPING 開発ドキュメント ---

## 1. システム構成図

本アプリケーションは **「プレゼンテーション層・アプリケーション層・データ層」の 3 層アーキテクチャ** に基づき、セキュリティとパフォーマンスを両立するよう設計しました。

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '13px', 'lineColor': '#dddddd'}, 'flowchart': {'nodeSpacing': 20, 'rankSpacing': 35}}}%%
graph LR
    linkStyle default stroke:#dddddd,stroke-width:2px

    User((プレイヤー))

    subgraph Presentation ["📱 プレゼンテーション層"]
        Game["ゲームロジック<br/>(React)"]
        Local["LocalStorage<br/>(設定・ハイスコア)"]
    end

    subgraph Application ["🛡️ アプリケーション層"]
        Auth["匿名認証<br/>(Auth)"]
        RLS{"RLS<br/>(門番)"}
    end

    subgraph Data ["🗄️ データ層"]
        DB[("PostgreSQL<br/>(scores)")]
    end

    User <-->|操作| Game
    Game <-->|読み書き| Local
    Game -->|スコア送信| Auth
    Auth -->|uid| RLS
    RLS -->|保存| DB
    DB -->|ランキング取得<br/>ソート＋上位N件| Game

    style User fill:#ffffff,stroke:#333,color:black
    style Game fill:#e1f5fe,stroke:#333,color:black
    style Local fill:#fff9c4,stroke:#333,color:black
    style Auth fill:#fce4ec,stroke:#333,color:black
    style RLS fill:#f9f,stroke:#333,stroke-width:2px,color:black
    style DB fill:#f96,stroke:#333,stroke-width:2px,color:black
```

---

## 2. 詳細フローチャート図

- 手書きの設計書のフローチャートをデジタル化しました。
- 全体の流れと、主にこだわった入力処理と Backspace 処理を掲載します。
- 手書きの設計書も次項で貼りますのでよろしければご覧ください。

### ・ゲーム全体のフローチャート図

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '12px'}, 'flowchart': {'nodeSpacing': 30, 'rankSpacing': 40}}}%%
flowchart TD
%% 矢印を「薄いグレー」に設定
    linkStyle default stroke:#dddddd,stroke-width:2px

    %% --- ノード定義 ---
    Title[タイトル画面]

    %% 横長ひし形のためのスペース調整（brタグを修正）
    CheckName{　　名前が<br/>入力済みか　　}

    Input[⌨️入力フォーム]
    CheckNG{　　NGワード<br/>がないか　　}
    Confirm{　　この名前で<br/>始めるか　　}

    DiffSelect[難易度選択]

    %% サブ画面グループ
    HighScore[ハイスコア時<br/>リザルト詳細]
    Ranking[全国ランキング]
    DevScore[開発者スコア]
    Share[シェア機能]

    %% ゲーム進行グループ
    Ready[Ready ?]
    Game[ゲーム画面]
    Result[リザルト画面]

    %% --- 接続フロー ---

    %% 1. スタート & 名前チェック
    Title --> CheckName
    CheckName -- YES --> DiffSelect
    CheckName -- NO --> Input

    %% 2. 名前入力ループ
    Input --> CheckNG
    CheckNG -- NO --> Input
    CheckNG -- YES --> Confirm

    Confirm -- NO --> Input
    Confirm -- YES --> DiffSelect

    %% 3. 難易度選択ハブ
    DiffSelect -- "決定" --> Ready
    DiffSelect -- "BACK" --> Title

    %% 脇道（難易度選択から）
    DiffSelect -- "📄クリック" --> HighScore
    HighScore --> DiffSelect
    DiffSelect -- "👑クリック/diff" --> Ranking
    %% 難易度選択へ戻るルート
    Ranking -- "↩️戻る/diff" --> DiffSelect

    %% 開発者スコア
    Ranking -- "👑クリック" --> DevScore
    DevScore --> Ranking

    %% 4. ゲームプレイ
    Ready -- "Enter" --> Game
    Ready -- "ESC" --> DiffSelect

    Game -- "終了" --> Result
    Game -- "ESC" --> Ready

    %% 5. リザルトからの分岐
    Result -- "Enter" --> Ready
    Result -- "ESC" --> DiffSelect
    Result -- "Xクリック" --> Share

    %% リザルトからランキングへの往復
    Result -- "👑クリック/result" --> Ranking
    Ranking -- "↩️戻る/result" --> Result

    %% リザルトからタイトルへの戻り
    Result -- "タイトルへ" --> Title

    %% --- スタイル定義（すべてに ,rx:10,ry:10 を追加） ---
    style Title fill:#fff2cc,stroke:#333,stroke-width:2px,color:black,rx:10,ry:10
    style Result fill:#f9f,stroke:#333,stroke-width:2px,color:black,rx:10,ry:10

    %% ひし形にも適用（レンダラーによってはひし形の角丸は効きにくい場合がありますが記述は合っています）
    classDef condition fill:#fff,stroke:#ffa000,stroke-width:2px,color:black,rx:10,ry:10;
    class CheckName,CheckNG,Confirm condition;

    style Input fill:#ffffff,stroke:#333,color:black,rx:10,ry:10

    style DiffSelect fill:#e3f2fd,stroke:#333,color:black,rx:10,ry:10
    style Ready fill:#bbdefb,stroke:#333,color:black,rx:10,ry:10
    style Game fill:#90caf9,stroke:#333,stroke-width:2px,color:black,rx:10,ry:10

    style Ranking fill:#fff2cc,stroke:#333,color:black,rx:10,ry:10
    style HighScore fill:#e8f5e9,stroke:#333,color:black,rx:10,ry:10
    style DevScore fill:#e8f5e9,stroke:#333,stroke-dasharray: 5 5,color:black,rx:10,ry:10
    %% 最後のcolorの値が抜けていたので修正しました
    style Share fill:#e8f5e9,stroke:#333,color:black,rx:10,ry:10
```

### ・ 入力分岐処理

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '13px', 'lineColor': '#cccccc'}, 'flowchart': {'nodeSpacing': 40, 'rankSpacing': 40}}}%%
graph LR
    %% 矢印を「薄いグレー」に設定
    linkStyle default stroke:#bbbbbb,stroke-width:2px,fill:none

    %% デザイン定義
    classDef default fill:#ffffff,stroke:#333,stroke-width:2px;

    %% === 【ここを変更しました】ひし形（判定）を黄色に変更 ===
    classDef decision fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;

    %% 成功（緑）のスタイル定義
    classDef process fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    %% ミス（赤）のスタイル定義
    classDef error fill:#ffebee,stroke:#c62828,stroke-width:2px;
    %% 終了/次へのスタイル定義
    classDef endstate fill:#666,stroke:#333,stroke-width:2px,color:#fff;

    %% =====================================
    %% 1. 普通の処理 (あ / a)
    %% =====================================
    subgraph Basic_Input ["1. 普通の処理 (例: あ/a)"]
        direction LR
        Start_A([開始: あ]) --> Check_A{入力キーは a ?}
        class Check_A decision

        Check_A -- Yes --> Green_A[aを緑で表示]
        class Green_A process

        Check_A -- No --> Red_A[aを赤で表示]
        class Red_A error

        %% 成功も失敗もここへ合流
        Green_A --> Next_A([次へ])
        Red_A --> Next_A
        class Next_A endstate
    end

    %% =====================================
    %% 2. 分岐処理 (し / si, shi)
    %% =====================================
    subgraph Shi_Input ["2. 分岐処理 (例: し / si, shi)"]
        direction LR
        Start_Shi([開始: し]) --> Check_S{s を押した?}
        class Check_S decision

        Check_S -- Yes --> Green_S[s を緑に]
        class Green_S process

        %% ミスルート
        Check_S -- No --> Error_S[sを赤で表示]
        class Error_S error

        Green_S --> Wait_Shi_2{次の入力は?}
        class Wait_Shi_2 decision

        Wait_Shi_2 -- h --> Green_Sh[h を緑に]
        class Green_Sh process

        Wait_Shi_2 -- i --> Complete_Si["i を緑に<br>si 完了"]
        class Complete_Si process

        %% hの後の分岐
        Green_Sh --> Check_Shi_I{i を押した?}
        class Check_Shi_I decision

        Check_Shi_I -- Yes --> Complete_Shi["i を緑に<br>shi 完了"]
        class Complete_Shi process

        %% hの後のミス
        Check_Shi_I -- No --> Error_Shi_I[iを赤で表示]
        class Error_Shi_I error

        %% 2文字目のミス(その他)
        Wait_Shi_2 -- その他 --> Error_Shi[iを赤で表示]
        class Error_Shi error

        %% 全ルート合流地点
        Next_Shi([次へ])
        class Next_Shi endstate

        Complete_Si --> Next_Shi
        Complete_Shi --> Next_Shi
        Error_S --> Next_Shi
        Error_Shi_I --> Next_Shi
        Error_Shi --> Next_Shi
    end

    %% =====================================
    %% 3. 分岐処理 (ち / ti, chi)
    %% =====================================
    subgraph Chi_Input ["3. 分岐処理 (例: ち / ti, chi)"]
        direction LR
        Start_Chi([開始: ち]) --> Branch_Chi{最初の入力は?}
        class Branch_Chi decision

        %% ti ルート
        Branch_Chi -- t --> Green_T[t を緑に]
        class Green_T process
        Green_T --> Check_Ti_I{i を押した?}
        class Check_Ti_I decision

        Check_Ti_I -- Yes --> Complete_Ti["i を緑に<br>ti 完了"]
        class Complete_Ti process
        Check_Ti_I -- No --> Error_Ti[tを赤で表示]
        class Error_Ti error

        %% chi ルート
        Branch_Chi -- c --> Green_C[c を緑に]
        class Green_C process
        Green_C --> Check_Chi_H{h を押した?}
        class Check_Chi_H decision

        Check_Chi_H -- Yes --> Green_Ch[h を緑に]
        class Green_Ch process
        Check_Chi_H -- No --> Error_Chi[hを赤で表示]
        class Error_Chi error

        Green_Ch --> Check_Chi_I{i を押した?}
        class Check_Chi_I decision
        Check_Chi_I -- Yes --> Complete_Chi["i を緑に<br>chi 完了"]
        class Complete_Chi process
        Check_Chi_I -- No --> Error_Chi2[iを赤で表示]
        class Error_Chi2 error

        %% 最初の分岐ミス
        Branch_Chi -- その他 --> Error_Chi_Root[tを<br>赤で表示]
        class Error_Chi_Root error

        %% 全ルート合流地点
        Next_Chi([次へ])
        class Next_Chi endstate

        Complete_Ti --> Next_Chi
        Complete_Chi --> Next_Chi
        Error_Ti --> Next_Chi
        Error_Chi --> Next_Chi
        Error_Chi2 --> Next_Chi
        Error_Chi_Root --> Next_Chi
    end

    %% =====================================
    %% 4. 「ん」の処理 (n, nn, xn)
    %% =====================================
    subgraph N_Input ["4. ん の処理 (n/nn/xn)"]
        direction LR
        Start_N([開始: ん]) --> Check_N1{n を押した?}
        class Check_N1 decision

        %% 1文字目ミス
        Check_N1 -- No --> Error_N[nを赤で表示]
        class Error_N error

        Check_N1 -- Yes --> Green_N1[n を緑に]
        class Green_N1 process
        Green_N1 --> Check_Next{"次の文字は<br>母音/ナ行以外?"}
        class Check_Next decision

        Check_Next -- "Yes <br>子音など" --> Auto_N["n確定(緑)<br>次の文字へ"]
        class Auto_N process

        Check_Next -- "No <br>nを押した" --> Green_N2["nn成立<br>nを緑に"]
        class Green_N2 process

        %% 2文字目ミス
        Check_Next -- "No <br>その他入力" --> Error_N2[二個目のnを<br/>赤で表示]
        class Error_N2 error

        %% 全ルート合流地点
        Next_N([次へ])
        class Next_N endstate

        Green_N2 --> Next_N
        Auto_N --> Next_N
        Error_N --> Next_N
        Error_N2 --> Next_N
    end
```

---

### ・ Backspace 処理のフローチャート図

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '13px', 'lineColor': '#cccccc'}, 'flowchart': {'nodeSpacing': 40, 'rankSpacing': 40}}}%%
graph LR
    %% 矢印を「薄いグレー」に設定
    linkStyle default stroke:#bbbbbb,stroke-width:2px,fill:none

    %% デザイン定義
    classDef default fill:#ffffff,stroke:#333,stroke-width:2px;
    classDef decision fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;
    classDef process fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef endstate fill:#666,stroke:#333,stroke-width:2px,color:#fff;

    %% =====================================
    %% 1. 通常 (あ/ai) の場合
    %% =====================================
    subgraph Normal_BS ["1. 通常 (例: あ/ai)"]
        direction LR
        State_Ai([入力済み: ai]) --> Check_BS_Ai{BS押した?}
        class Check_BS_Ai decision

        Check_BS_Ai -- Yes --> Delete_Ai[iをcurrent表示に]
        class Delete_Ai process

        Check_BS_Ai -- No --> Wait_Ai([入力待機])
        class Wait_Ai endstate

        Delete_Ai --> Wait_Ai
    end

    %% =====================================
    %% 2. 分岐: sh まで押した時
    %% =====================================
    subgraph Shi_BS ["2. 分岐中 (例: sh まで入力)"]
        direction LR
        State_Sh([入力済み: sh]) --> Check_BS_Sh{BS押した?}
        class Check_BS_Sh decision

        Check_BS_Sh -- Yes --> Delete_Sh_H["si表示に戻して<br/>iをcurrent表示に"]
        class Delete_Sh_H process

        Check_BS_Sh -- No --> Next_Sh([入力待機])
        class Next_Sh endstate

        Delete_Sh_H --> Next_Sh
    end

    %% =====================================
    %% 3. 分岐: ち の c を押した時
    %% =====================================
    subgraph Chi_C_BS ["3. 分岐開始 (例: c まで入力)"]
        direction LR
        State_C([入力済み: c]) --> Check_BS_C{BS押した?}
        class Check_BS_C decision

        Check_BS_C -- Yes --> Delete_C["ti表示に戻して</br>tをcurrent表示に"]
        class Delete_C process

        Check_BS_C -- No --> Next_C([入力待機])
        class Next_C endstate

        Delete_C --> Next_C
    end

    %% =====================================
    %% 4. 分岐: ち の ch を押した時
    %% =====================================
    subgraph Chi_CH_BS ["4. 分岐中 (例: ch まで入力)"]
        direction LR
        State_Ch([入力済み: ch]) --> Check_BS_Ch{BS押した?}
        class Check_BS_Ch decision

        Check_BS_Ch -- Yes --> Delete_Ch["hをcurrent表示に"]
        class Delete_Ch process

        Check_BS_Ch -- No --> Next_Ch([入力待機])
        class Next_Ch endstate

        Delete_Ch --> Next_Ch
    end
```

---

### ・ 単語処理のフローチャート

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '13px', 'lineColor': '#cccccc'}, 'flowchart': {'nodeSpacing': 40, 'rankSpacing': 40}}}%%
graph LR
    %% 矢印を「薄いグレー」に設定
    linkStyle default stroke:#bbbbbb,stroke-width:2px,fill:none

    %% デザイン定義
    classDef default fill:#ffffff,stroke:#333,stroke-width:2px;
    classDef decision fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;
    classDef process fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef error fill:#ffebee,stroke:#c62828,stroke-width:2px;
    classDef endstate fill:#666,stroke:#333,stroke-width:2px,color:#fff;

    %% =====================================
    %% 単語処理フロー
    %% =====================================
    subgraph Word_Process ["単語処理フロー"]
        direction LR

        Start([入力終了判定]) --> Check_All_Green{全て緑色?}
        class Check_All_Green decision

        %% YESルート：次の単語へ
        Check_All_Green -- YES --> Load_Next[次の単語をロード<br>loadRandomWord]
        class Load_Next process

        Load_Next --> Next_Word([次の単語へ])
        class Next_Word endstate

        %% NOルート：修正待ち
        Check_All_Green -- NO --> Wait_Correction[修正待ち<br>全て緑になるまで継続]
        class Wait_Correction error

        %% 修正待ちはループ的な意味合いなので、入力待機へ戻す線
        Wait_Correction -.-> Start
    end
```

---

## 3. ER 図

- 管理人スコアと一般ユーザーは同じ構造のテーブルになるため、あえて一つのテーブルで管理し、is_creator カラムの Boolean 値が false を一般ユーザーとして扱い、一般ユーザーを全国ランキングに、管理人は is_creator カラムの Boolean 値を true にして開発者スコアに分断し、効率的なデータ管理を実現しています。

```mermaid
erDiagram
    %% キャプチャ画面の型と制約を完全に反映
    scores {
        bigint id PK "連番 (Identity)"
        uuid user_id "ユーザー識別用ID"
        text name "プレイヤー名"
        bigint score "スコア"
        integer correct "正解キー数"
        integer miss "ミスキー数"
        integer backspace "BS回数"
        integer combo "最大コンボ数"
        double_precision speed "入力速度(KPM)"
        text difficulty "難易度"
        boolean is_creator "作成者フラグ"
        timestamp_with_time_zone created_at "保存日時"
    }
```

## 4. 技術選定

### フロントエンド / インフラ

| カテゴリ             | 技術                  | 選定理由                                                                                                   |
| :------------------- | :-------------------- | :--------------------------------------------------------------------------------------------------------- |
| **Framework**        | **React**             | 生の JavaScript と比較し、保守性と拡張性を重視。コンポーネント化による状態管理のしやすさを評価。           |
| **Language**         | **TypeScript**        | 開発段階での型定義によりバグを削減し、品質や安全性、長期的な機能拡張においても堅牢なコードを維持するため。 |
| **Build Tool**       | **Vite**              | HMR（Hot Module Replacement）による高速な開発サイクルと、Vitest との親和性を考慮。                         |
| **BaaS**             | **Supabase**          | PostgreSQL の学習経験を活かしたデータ管理。RLS によるセキュリティ担保と開発効率の両立。                    |
| **Testing**          | **Vitest** / **TESTING LIBRARY**            | 環境構築が容易で、機能追加時のロジック崩れ（デグレ）を防止し品質を担保するため。                           |
| **Monitorring**      | **Sentry** | 実行時のエラーやパフォーマンスをリアルタイムで検知し、ユーザー環境での不具合を迅速に修正する為
| **Linter/Formatter** | **ESLint / Prettier** | 自動整形ツールによるコード品質の一貫性を保つ目的。                                                         |
| **Hosting**          | **Vercel**            | Vite/React 環境との親和性が高く、高速なデプロイが可能なため。                                              |
---

## 技術選定のポイント

### 1. 「Vanilla JS」から「React/TypeScript」への移行

プロジェクト初期は DOM 操作の基礎理解のため `HTML/CSS/JavaScript` で構築していましたが、DOM 操作が複雑化し、将来機能追加等を行うと管理が大変になるため、**保守性**と**拡張性**を意識して移行しました。

- **保守性:** 生の JS で構築していたが DOM 操作が複雑化し管理が限界になったため `React` へ移行。
  仮想 DOM による計算ステップが増えるトレードオフはあるが、**宣言的 UI とコンポーネント分割による保守性・拡張性を優先した。**

- **型安全性:** `TypeScript` の型チェックはコンパイル時のみで実行時には効かないが、
  開発段階でバグの大半を検出できる点と、将来の機能拡張時に**堅牢なコードを維持できる点**を評価して採用。

### 2. Supabase による堅牢なデータ管理

ランキング機能などのデータ整合性を保つため、型定義が厳格な**PostgreSQL**を採用しています。

- **セキュリティ:** `RLS（Row Level Security）`と`ストアドプロシージャ`、`制約`を活用し、ユーザー本人以外のデータ操作を制限。
- **開発効率:** 信頼性の高いバックエンドツールを導入することで、**UI/UX の開発に注力できる環境を整えました。**
- **勉強目的** `OSS-DB Silver` を取得していた為、実際にPostgreSQLを扱ってみたかったという目的もあります。

| 操作 | 保護方法 | 理由 |
|---|---|---|
| SELECT | RLS = 全公開 | ランキングは誰でも見える（意図的 |               
| INSERT/UPDATE/DELETE | `security definer` 関数 + `auth.uid()` + NOT NULL制約 |本人のみ、かつ有効なセッション必須 |                                       
| スコア改ざん | バリデーション | 不正値の弾き飛ばし |

**なぜ REST ではなく RPC（ストアドプロシージャ）を使うのか**

REST でハイスコード更新を実装する場合、「取得 → フロントで比較 → 更新」の流れになります。
この設計だと比較ロジックがフロントに露出するため、DevTools からスコアを改ざんして送り込まれるリスクがあります。

RPC（`security definer` 関数）を経由することでフロントから直接テーブルを操作させず、
**バリデーションとハイスコア比較をサーバー側で完結**させています。
ロジックをデータベース層に閉じ込めることで、フロントからの不正な操作を根本から防ぐ設計にしています。

**SELECT を全公開にしている理由**

INSERT / UPDATE / DELETE は `auth.uid()` で本人のみに制限していますが、SELECT は意図的に全公開としています。
認証を要求するとランキングが自分のデータしか見えなくなるため、公開データとして扱うトレードオフを選択しています。

**読み取り最適化設計**

スコアの集計・計算は `RPC` 側で完結させ、フロントは結果を受け取るだけの設計にしています。
書き込み時のコストは増えますが、読み取りを軽量に保つことで**通信量を削減し、スマホ環境でも高速に動作します。**

### 3. テストによる品質担保

現状はゲームロジックを中心に Vitest で単体テストを実施し、機能追加による既存ロジックの崩壊を防いでいます。

| テスト種別 | 現状 | 今後の方針 |
|---|---|---|
| 単体テスト | ✅ ゲームロジック中心に実施済み | カバレッジ拡充 |
| 結合テスト | ❌ 未実施 | コンポーネント間の連携検証 |
| E2E / システムテスト | ❌ 未実施 | デプロイ環境での実際の操作検証 |

---


## 5. セキュリティ対策

個人開発のゲームアプリですが、Webアプリケーションとしてセキュリティを意識し、以下の対策を講じています。

### 1. RLS (Row Level Security) によるデータ保護

ローカルストレージ採用なので直接APIを叩かれるとどうしても防げない為、**「データベースの最前線で防ぐ」**設計にしています。

- **不正書き込み防止:** `auth.uid() = user_id` のポリシーを適用し、**本人のスコアのみ**挿入・更新・削除可能に制限。
- **なりすまし防止:** Supabase AuthのUIDを「仮の身分証明書」として利用。
- **最小権限の原則:** 必要なカラム以外へのアクセス権限を遮断。
- **Bot対策:** チェック制約を使い、ありえないスコアや挙動を弾く設定に。(こちらは運用データを見ながら閾値を調整予定)

### 2. インジェクション攻撃対策

- **SQLインジェクション:** プレースホルダを利用するSupabaseクライアント経由で操作を行うため、SQL文の直接的な組み立てを排除。
- **XSS (クロスサイトスクリプティング):** Reactの標準機能によるエスケープ処理を活用し、スクリプトの埋め込みを防止。
- **OSコマンドインジェクション:** OSコマンドを実行するプログラムを書いていないが、シェルを起動してコマンドを実行する関数の使用は避ける。(exec()やpassthru()等)

### 3. HTTPセキュリティヘッダー（vercel.json）

`vercel.json` にレスポンスヘッダーを設定し、ブラウザレベルの攻撃に対策しています。

| ヘッダー | 設定値（概要） | 設定しないと起きること |
|---|---|---|
| **CSP** | 自ドメイン・Supabase・Sentryのみ許可 | XSSで注入されたスクリプトが自由に実行され、LocalStorageやセッション情報を盗まれる |
| **HSTS** | max-age=2年・preload | 初回HTTP接続をSSLストリッピングで中継される → 中間者攻撃 → Cookieを盗みセッションハイジャック。`preload` で初回から強制HTTPS |
| **X-Content-Type-Options** | nosniff | ブラウザがファイルの中身を独自解釈し、画像ファイルに埋め込まれたスクリプトをJSとして実行させられる（MIMEスニッフィング） |
| **X-Frame-Options** | DENY | 悪意あるサイトにiframeで埋め込まれ、見えないボタンをクリックさせられる（クリックジャッキング） |
| **Referrer-Policy** | strict-origin-when-cross-origin | 外部サイト遷移時にURLのパスが漏れる |
| **Permissions-Policy** | カメラ・マイク・位置情報を無効化 | スクリプト注入時にデバイスのセンサー類へのアクセスを許してしまう |

> **CORSについて**
> vercel.json にCORS設定はありません。Supabase APIのCORSはSupabaseダッシュボード側で管理しており、
> フロントはVercelから静的ファイルを配信するだけのため、Vercel側でのCORSヘッダーは不要な構成です。

### 4. サプライチェーンセキュリティ

- **依存関係の管理:** 不要なライブラリを導入せず、`npm audit` 等で定期的に脆弱性をチェック。
- **機密情報の管理:** 機密情報を直書きせず、APIキー等は `.env` ファイルで管理し、`.gitignore` でGitHubへの流出を防止。

---

## 6. 開発プロセスと設計資料

- 開発前の設計図と開発後の設計図の手書きの設計書です。よろしければご覧ください。
- 開発後の設計書？とはなりますが、改めて書き直すことで設計書の重要性を自分なりに理解することが出来たので書いてよかったです。

<details>
<summary><strong>📖 手書きの設計ノートを見る（クリックで展開）</strong></summary>

#### ▼ 1. 開発する前に書いた初期の設計図

<img src="images/Before_concept.jpg" alt="初期の設計図のコンセプト" width="600" style="border: 1px solid #ddd; border-radius: 8px;">
<img src="images/Before_whole.jpg" alt="初期の設計図の全体像" width="600" style="border: 1px solid #ddd; border-radius: 8px;">

<br>

#### ▼ 2. ⇣【開発後に書いた設計図一部抜粋】シンプルなフローチャート

<img src="images/After_result_simpleFlowchart.jpg" alt="シンプルなフローチャート" width="600" style="border: 1px solid #ddd; border-radius: 8px;">

<br>

#### ▼ 3. 画面遷移と入力分岐等の詳細フローチャート

<img src="images/After_title_difficulty_flowchart.jpg" alt="画面遷移と入力分岐等の詳細フロー" width="600" style="border: 1px solid #ddd; border-radius: 8px;">

#### ▼ 4. BackSpace 処理のフローチャート、データベース設計と機能要件(BackEnd 構成も)

<img src="images/After_Backspace_gameLogic_ER_function.jpg" alt="BackSpace処理のフロー、DB設計と機能要件" width="600" style="border: 1px solid #ddd; border-radius: 8px;">
<img src="images/BackEnd.jpg" alt="バックエンド構成" width="600" style="border: 1px solid #ddd; border-radius: 8px;">
<img src="images/BackEnd_setting_Howtoplay.jpg" alt="バックエンド構成" width="600" style="border: 1px solid #ddd; border-radius: 8px;">

<br>

#### ▼ 5. セキュリティ構成

<img src="images/Credit_security.jpg" alt="セキュリティ構成" width="600" style="border: 1px solid #ddd; border-radius: 8px;">

</details>

## 7. コード説明