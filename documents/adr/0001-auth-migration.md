# ADR-0001: Supabase Auth 撤去と Spring Boot 自前 JWT 認証への移行

## Status

Proposed (2026-05-26)

---

## Context

### 撤退の経緯

2026-05-25 のフロントデプロイ時、AWS 新環境（CloudFront + Lambda 構成）で
名前検証が失敗する事象が発生。原因は以下：

- Spring Boot Lambda が **完全 private VPC** に配置されている
- Supabase の JWKS エンドポイント（インターネット経由）に到達不可
- → JWT 検証フィルタが起動時から機能不全

応急対応として `getRanking()` のみ S3 配信 → Railway API 経由に切り戻し、
旧 Vercel フロントでランキング表示を復活させている。

### 並走する積年の課題

| 課題 | 重要度 | 関連メモ |
|---|---|---|
| 認証トークンを localStorage に保管している（XSS 被弾時に窃取される） | 高 | `auth-token-storage-strategy.md` |
| NAT Gateway 追加で月額 +$32 のランニングコスト発生 | 中 | `aws-account-quota-state.md` |
| Supabase という外部 BaaS 依存（AWS 移行のコンセプトと整合しない） | 中 | `aws_migration_architecture.md` |

これらを一度に解消する工事として本 ADR を起票する。

---

## Decision Drivers

優先度順：

1. **外部 Auth 依存の撤去**（AWS 完結アーキテクチャに統一）
2. **NAT Gateway 不要化**（Lambda private VPC のまま外部到達不要にする）
3. **localStorage → HttpOnly Cookie 化**（XSS 耐性の底上げ）
4. 既存のスコア改ざん耐性は最低でも維持する
5. 個人開発の現実的工数（2 週間以内が目安）

---

## Options Considered

### 案 A: NAT Gateway 追加（現状維持）

- 月額 +$32 を許容し、Supabase JWKS への到達経路を確保する
- 工数: 30 分
- **却下**: Supabase 依存を温存。localStorage 問題も残る。「現実的な逃げ」だが、根本解決にならない。

### 案 B: Supabase 継続 + Spring Boot を認証プロキシ化

- フロントは Spring Boot 経由でのみ Supabase を呼び、Spring Boot 側で HttpOnly Cookie 載せ替え
- 工数: 数日
- **却下**: localStorage は解消するが、Supabase 依存と NAT コストが残る。1.5 つの問題しか解けない。

### 案 C: Cognito User Pool 移行 + Cookie 化

- メアド + パスワードによる本格認証を Cognito で実装
- 工数: 1〜2 週間
- **却下**: 詳細は下記「Cognito 検討結果」参照

### 案 D: 独自認証実装（パスワードハッシュ管理含むフルスクラッチ）

- bcrypt 等で自前管理
- 工数: 2 週間〜
- **却下**: パスワード保管・ハッシュ管理は事故リスクが高い。ライブラリ解禁してもメンテ責務が重い。

### 案 E（採用）: Spring Boot 自前 JWT 発行 + Spring Security 導入 ⭐

- **ゲストユーザー**: Spring Boot が ES256 で署名した JWT を発行 → HttpOnly Cookie
- **正規ユーザー**: 今回スコープ外（メアド管理しないため）
- **引継ぎ機能**: サーバ発行の引継ぎコード方式を継続（JWT 認証下で発行・利用）
- 工数: 1〜1.5 週間

---

## Cognito 検討結果（案 C 却下の理由）

検討当初は「Cognito 移行が本命」と仮定していたが、要件詰めの過程で**過剰設計**と判明した。

### 要件とのギャップ

| Cognito の主機能 | 今回必要か |
|---|---|
| メアド + パスワード管理 | ❌ 今回はメアド扱わない |
| パスワードリセット（メール経由） | ❌ 引継ぎコード再発行で代替 |
| MFA / OAuth ソーシャルログイン | ❌ 今回スコープ外 |
| パスワードハッシュ管理 | ❌ パスワード保管しない |
| 認証情報の安全な金庫 | ❌ 金庫に入れるものがない |

→ **「金庫を買っても入れるものがない」**状態。

### 加えて発覚した技術的非対称性

- Cognito User Pool は**匿名認証を標準提供しない**
- Identity Pool の unauthenticated identity は **JWT ではなく IAM 一時クレデンシャル**
- Supabase の `signInAnonymously()` 相当を Cognito で再現するには「裏でランダム username+password を自動発行して User Pool に登録」する必要があり、**MAU 課金対象**になる

→ Supabase の自動匿名認証を Cognito で再現する開発・運用コストが割に合わない。
Supabase は PostgreSQL と統合され、RLS で権限制御していたため、バックエンドの管理コストがかからなかった。同等の安全性を Cognito + 自前バックエンドで再現するとインフラ管理コストが増大する。

### 将来の余地

将来「メアド認証」「ソーシャルログイン」を追加する判断をしたタイミングで Cognito 導入を再検討する。現時点では**選択肢として温存**するだけで足りる。

---

## Decision

### 採用案

**案 E: Spring Boot 自前 JWT 発行 + Spring Security 導入**

### JWT 署名アルゴリズム

**ES256**（ECDSA + secp256r1 + SHA-256）

理由：
- 既存 `JwtKeyProvider` が ES256 前提で実装済み → 資産を最大活用できる
- RS256 は素因数分解が困難、ES256 は楕円曲線暗号という数学グラフ的な難しさで近年の標準になりつつある
- RS256 と比べて鍵サイズが小さく（256bit vs 2048bit）、Lambda cold start で有利
- 同程度の強度でかつサイズが軽いため検証が早く CPU の負荷を抑えられる
- 署名・検証コストが低く、低レイテンシ要件のゲームに適する
- Supabase が同じ理由で ES256 を採用していた実績がある
- 対応していないライブラリがあるというデメリットがあるが `SpringSecurity` は導入済み

### 鍵管理方針

| 項目 | 方針 |
|---|---|
| 秘密鍵保管 | **Lambda 環境変数（Base64 文字列）**（Terraform から焼き込み） |
| 鍵フォーマット | **PKCS#8 DER（Raw バイナリ）** を Base64 化して環境変数に格納 |
| 公開鍵配布 | `GET /.well-known/jwks.json` で配布（将来の検証者拡張に備える） |
| ローテーション | **手動ローテ**（半年〜1年に1回 + 漏洩時の緊急ローテ）。`terraform apply` で env vars を上書き |
| VPC Endpoint | **不要**（既存「VPC エンドポイント全廃」方針を継続、月額 $0） |

**判断根拠**：本サービスは個人情報・課金情報を持たない匿名ランキングであり、鍵漏洩時の重大度は中レベル。バックエンドバリデーション（物理的妥当性・整合性チェック・カラム制約）が DB の整合性を守るため、JWT 偽造による被害は限定的。自動ローテに月 $7.7（Secrets Manager + Endpoint）を払う費用対効果が個人開発レベルでは出にくいため、環境変数注入 + 手動ローテで実用十分と判断。

**選択肢比較（記録のため）**：

| 案 | 月額 | ローテ自動化 | 採否 |
|---|---|---|---|
| **A: env vars + 手動ローテ** | **$0** | ❌ | **採用** |
| B: Parameter Store + 手動ローテ | +$7.3 (VPC Endpoint) | ❌ | 不採用（state クリーン化のみで費用対効果薄い） |
| C: Secrets Manager + 自動ローテ | +$7.7 | ⭕ | 不採用（自動化価値が個人開発レベルでは低い） |
| D: env vars + EventBridge 自作ローテ | $0 | ⭕（自作） | 不採用（事故面広い、Phase 完了後の学習選択肢として温存） |

**PKCS#8 DER を採用した理由**：

| 形式 | 読み込みコード | パース複雑度 |
|---|---|---|
| PKCS#8 DER（Raw） | `new PKCS8EncodedKeySpec(Base64.getDecoder().decode(env))` 一発 | 最小 |
| PEM | `-----BEGIN-----` 削除 → Base64 デコード → Raw と同じ処理 | 中 |
| JWK | `JWK.parse(json)` だが鍵生成側で JSON 構造を組む必要 | 大 |

- 環境変数に Base64 文字列として格納するだけで完結
- PEM の改行コード問題（CRLF/LF）が潜まない

### 鍵漏洩時のリスク評価

**攻撃者ができること**：

| 攻撃 | 影響 |
|---|---|
| 任意 `user_id` の JWT 偽造 | 他人になりすまして API 操作 |
| 偽スコア大量送信 | ランキング荒らし |
| 他人のスコア書き換え | UX 毀損 |
| 引継ぎコード操作 | 別環境への不正データ移動 |

**攻撃者ができないこと**：

| 不可項目 | 理由 |
|---|---|
| 個人情報取得 | そもそも保持していない（匿名 user_id のみ） |
| 課金操作 | 課金システムなし |
| AWS リソース操作 | IAM 認証の別軸 |

**防御層でフィルタされる攻撃**：

- 物理的に不可能なスコア → バックエンドバリデーション（speed 上限、整合性）
- 大量送信 DoS → API Gateway スロットリング（100 burst / 50 rate）+ MigrationRateLimiter
- NG ワード名前 → サーバ側 NG ワード検証
- 同難易度の複数行登録 → `UNIQUE(user_id, difficulty)` 制約

→ JWT 偽造が成立しても、**バックエンドバリデーションが DB の整合性を守る**設計。

**復旧手順**：

1. 漏洩発覚 → 新鍵を生成
2. `terraform apply` で env vars を上書き → 偽 JWT 全無効化
3. 異常データを SQL で削除（`scores` テーブルから攻撃時間帯の偽 user_id 行を削除）
4. 全ユーザーは次回アクセス時に `ensureGuestSession()` 経由で新 Cookie を自動取得

**漏洩発覚チャネル**：

| 経路 | 対策 |
|---|---|
| Git に誤コミット | `.gitignore` に `*.pem` `*.der` `private_key*` 追加、GitHub Secret Scanning |
| CI ログへの誤出力 | コードレビュー・PR チェック |
| Terraform state 漏洩 | S3 backend + KMS 暗号化（既存対応） |
| AWS Console 権限漏洩 | CloudTrail で異常 API コール監視 |
| ランキングへの大量偽スコア | 自身の目視（最終防衛線） |

**前提が変わったら再検討するトリガー**：

- メールアドレス認証や個人情報を扱う機能を追加した場合 → 案 C（Secrets Manager + 自動ローテ）への移行を検討
- ユーザー数が大幅増加して目視監視が機能しなくなった場合 → 同上
- 課金機能を追加した場合 → 必須で案 C へ

### Cookie 設計

```
Set-Cookie: auth-token=<JWT>;
            HttpOnly;
            Secure;
            SameSite=Strict;
            Path=/;
            Max-Age=2592000   ← 30日
```

- **HttpOnly**: JavaScript からアクセス不可（XSS 耐性）
- **Secure**: HTTPS 通信のみ
- **SameSite=Strict**: CSRF 対策の第一防御
- **Max-Age=30 日**: Supabase の Refresh Token と同等の有効期間

### CSRF 対策

**Spring Security のデフォルト（CSRF 有効）を採用**し、Double Submit Cookie パターンを使う。
state-changing なエンドポイント（POST/PUT/DELETE）は CSRF トークン検証必須。

- 多層防御： `SameSite=Strict` + CSRF トークン
- 古いブラウザの `SameSite` 未対応経路や、サブドメイン経由の漏れに対する保険
- Spring Security デフォルトに従う方が安全（無効化する手間より使う方が無事故）

### ゲスト認証 API 設計

| エンドポイント | 役割 | 認証 | レスポンス |
|---|---|---|---|
| `POST /auth/guest` | Cookie 検証 + 失効/未存在時に新規発行 | optional cookie | `204 No Content`（+ Set-Cookie） |

- **冪等性**: 既存 Cookie が有効なら no-op（再発行しない）
- **失効時挙動**: 新規 `user_id` で発行（refresh 機構なし、リフレッシュエンドポイントは別立てしない）
- **フロント側ヘルパー**: `ensureGuestSession(): Promise<void>` として実装。引数なし、`credentials: 'include'` で Cookie 自動送受信

```typescript
// src/services/sessionHelpers.ts (リファクタ後)
export const ensureGuestSession = async (): Promise<void> => {
  const response = await fetch(`${API_BASE}/auth/guest`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("ゲストセッションの確立に失敗しました");
};
```

### ゲスト認証フロー

```
[初回アクセス]
  Frontend → POST /auth/guest (Cookie なし)
  Backend  → user_id = UUID 生成
           → JWT 発行（sub=user_id, exp=30日）
           → Set-Cookie で HttpOnly Cookie 返却 (204)
  Frontend → 以降の API 呼び出しで Cookie 自動送信

[2回目以降 / Cookie 有効]
  Frontend → POST /auth/guest (Cookie あり)
  Backend  → JwtAuthenticationFilter で Cookie から JWT 取り出し → 検証OK
           → 204 No Content (no-op、再発行しない)

[Cookie 失効後]
  Frontend → POST /auth/guest (Cookie あり・無効)
  Backend  → JWT 検証失敗 → 新 user_id で再発行
           → 別ユーザーとして再スタート（過去スコアは引継ぎコードで継承）
```

### `ensureGuestSession()` の呼び出しタイミング

HttpOnly Cookie は JS から有効期限が読めないため、フロント側で「Cookie が切れたか」を判定できない。サーバ側の判定に委ねる前提で、以下の 2 タイミングで呼ぶ：

```
[① アプリ起動時に 1 回呼ぶ]
  App.tsx の useEffect で ensureGuestSession() を実行
  → サーバ側で「Cookie 有効なら no-op、無効なら新規発行」
  → 「初回」「失効後の初回起動」を両方カバー

[② 401 を受けたらリカバリ]
  fetch ラッパー内で 401 を検知 → ensureGuestSession() → 元の API リトライ
  → ユーザーが 30 日以上画面を開きっぱなしだった場合の保険
  → 現実発生率は低いが、UX 上「突然 API が失敗する」状態を避ける防御層
```

```typescript
// 例: src/services/apiFetch.ts
export const apiFetch = async (path: string, init?: RequestInit) => {
  const res = await fetch(path, { ...init, credentials: "include" });
  if (res.status === 401) {
    await ensureGuestSession();
    return fetch(path, { ...init, credentials: "include" });
  }
  return res;
};
```

→ フロントは「30 日」を一切意識しない設計。Cookie の生存判定は完全にサーバ責務。

### ハイブリッド方式の認識

「Cookie 認証」と「引継ぎコード」は責務分離した別レイヤーとして扱う：

| レイヤー | 役割 | 有効期間 |
|---|---|---|
| Cookie | アクティブ期間中のセッション維持 | 30 日（再アクセスのたびにスライド可） |
| 引継ぎコード | 長期離脱者のためのデータ延命機構 | **無期限**（1回使い切り） |

これは「本会員機能（メアド認証等）実装前のハイブリッド方式」と位置づける。将来メアド認証を導入した時点で引継ぎコードは廃止候補になる。

### 多層レート制限（L1〜L4）

```
[攻撃リクエスト]
   ↓
[L1] CloudFront / WAF        ← 未導入（将来課題）
   ↓
[L2] API Gateway スロットリング ← 設定済み（burst=100 / rate=50）
   ↓
[L3] アプリ層 MigrationRateLimiter ← issue / import 両方 1分5回
   ↓
[L4] DB / 冪等処理              ← 既存維持
```

- **L2 設定済み**：`infra/api_gateway.tf` の `default_route_settings { throttling_burst_limit=100; throttling_rate_limit=50 }`
- **L3 改修**：現状 import 側にのみ適用されている `MigrationRateLimiter.checkOrThrow()` を、`issueCode` 側にも適用（1分5回）。冪等処理だけでは Lambda の Concurrent Executions を食い潰す DoS を防げないため
- **将来課題**：WAF 導入は月額コストとのバランスで判断保留

### スコア改ざん耐性

JWT 認証だけでは「自分の user_id で異常スコアを送る」攻撃を防げないため、**バックエンドバリデーション**を併設する：

| チェック | 内容 |
|---|---|
| 物理的妥当性 | speed が人間業の上限を超えないか、score が範囲内か |
| 整合性 | correct + miss > 0、combo ≤ correct |
| 再計算 | フロント計算式と同じ式でサーバ側計算 → 一致確認 |
| レート制限 | 同一 user_id からの送信頻度上限（L3 と同レベル） |
| アンチボット | フロント側で人力入力かどうかの判定（既存実装） |

**現状はアンチボットチェック + リクエストバリデーション + カラム制約（NOT NULL / CHECK 制約）で対応可能と判断**。これ以上の厳格化は本会員機能実装時に再検討する。

---

## Consequences

### 正の影響

- **NAT Gateway 不要化**: 月額 -$32 を恒久的に削減
- **HttpOnly Cookie 化**: XSS で JWT を窃取されるリスクが消滅
- **依存削減**: Supabase という外部 BaaS の障害影響から独立
- **Spring Security 導入**: `@AuthenticationPrincipal`、`@PreAuthorize`、`AuthenticationEntryPoint` 等の標準機能が使えるようになる
- **学習価値**: Spring Security と OAuth2 関連の仕組みを実装ベースで習得できる
- **フロントの簡素化**: `accessToken` を引き回す煩雑さが消える

### 負の影響

- **秘密鍵管理責務の発生**: 鍵生成・Terraform tfvars 管理・半年〜1年ごとの手動ローテ運用が必要。ローテ手順書を `documents/operations/` に整備する
- **匿名ユーザーの "なりすまし" は完全には防げない**: JWT 自体は Cookie 窃取（XSS 経由）や端末乗っ取りで漏れる可能性がある。緩和策はバックエンドバリデーション
- **既存 `scores.user_id` データの整合性**: 旧 Supabase Auth UUID と新規発行 UUID が混在する。マイグレーションは「自然消滅を待つ」方針（下記参照）
- **長期離脱ユーザーの自動別人化**: Cookie 失効 = 別 `user_id` になる。引継ぎコードを事前発行していないユーザーは過去スコアを失う（UX で明示的に誘導する）

---

## Migration Strategy

### 移行順序の原則：旧環境を生かしたまま新環境を完成させる

```
Phase 1: 新環境バックエンド完成（旧 Vercel + Railway は稼働継続）
Phase 2: 新環境フロント完成・接続確認（CloudFront 配信）
Phase 3: DNS 切替（criticaltyping.net を新環境へ）
Phase 4: 旧環境停止
```

ビッグバン切替は採用せず、各 Phase 完了時点で **旧環境に戻せる状態** を維持する。

### Phase 1: バックエンド改修（typing-api 側）

| 項目 | 内容 |
|---|---|
| 依存追加 | `spring-boot-starter-security` のみ（AWS SDK は不要、環境変数注入のため）⭐|
| `JwtKeyProvider` 改修 | JWKS HTTP fetch ロジックを撤去、**Lambda 環境変数（Base64 文字列）から PKCS#8 DER をデコードしてロード**に変更。クラス名を `LocalKeyProvider` 等に変更(JwtKeySetに変更、(Jwt Web Key Setから複数鍵取得という由来))⭐|
| 鍵生成・配置スクリプト | `infra/scripts/` 等にローカル実行用の ES256 鍵ペア生成スクリプトを配置（**生成物は Git 管理しない**）。`.tfvars` または `terraform apply -var` 経由で Base64 文字列を Lambda env vars に渡す ⭐|
| `JwtAuthenticationFilter` 改修 | HS256 フォールバック撤去、Cookie 読み取りに対応、Spring Security の `OncePerRequestFilter` として `SecurityFilterChain` に登録 |
| 新規: `SecurityConfig` | `SecurityFilterChain` Bean、エンドポイントごとの認可ルール宣言、CSRF 設定 |
| 新規: `AuthController` | `POST /auth/guest`（冪等な Cookie 確認/発行） |
| 新規: `JwksController` | `GET /.well-known/jwks.json` で公開鍵配布 |
| 新規: `JwtIssuer` Service | JWT 署名発行ロジック（純粋関数として単体テスト可能に） |
| 既存 Controller の改修 | `request.getAttribute("userId")` を `@AuthenticationPrincipal` に置換 |
| `MigrationRateLimiter` 拡張 | `issueCode` 側にも `checkOrThrow()` 適用（1分5回） |
| 引継ぎコード長期化 | `MigrationService.CODE_TTL` 撤去、`migration_codes.expires_at` 削除（Flyway V12）、Cleanup を `created_at < (now - 1年)` に変更 |
| **Phase 1 検収** | 旧環境 `user_id` を使った動作確認。旧 Supabase Auth 発行 UUID を持つ `scores` レコードへの読み書きが壊れていないか curl/Postman で検証。`POST /auth/guest` → Cookie 発行 → `GET /api/scores` 動作確認、旧 UUID で `scores` を仕込み → 引継ぎコード発行 → 新 UUID でインポート E2E。**Phase 2 着手前にここで止める**ことでバックエンド単体の健全性を確定 |

### Phase 2: フロントエンド改修（Typing-game 側）

| 項目 | 内容 |
|---|---|
| Supabase Auth SDK 撤去 | `@supabase/supabase-js` の Auth 部分を未参照に |
| `sessionHelpers.ts` 改修 | `requireSession()` → `ensureGuestSession(): Promise<void>` に置換 |
| `migrationApi.ts` 改修 | `Authorization: Bearer` 廃止、引数から `accessToken` 削除、`credentials: 'include'` 付与 |
| `useIssueMigrationCode` / `useImportMigrationCode` 改修 | `requireSession()` 呼び出しを `ensureGuestSession()` に置換 |
| API 呼び出し総点検 | `credentials: 'include'` を全フェッチに付与 |
| `apiFetch` ラッパー新設 | 401 検知 → `ensureGuestSession()` → 元 API リトライ、を1箇所に集約 |
| `ensureGuestSession()` の起動時呼び出し | `App.tsx` の `useEffect` で 1 回呼ぶ、非同期で行い画面をブロックしないようにする |
| CSRF トークン | Spring Security の Double Submit パターンに合わせて `X-CSRF-TOKEN` ヘッダ付与 |
| localStorage 撤去 | Supabase JWT を保持している箇所を削除 |
| 引継ぎ UI 警告 | 「引継ぎを実行すると現在のスコアは消えます」を明示（上書き仕様の UX 補完） |
| CSP 更新 | `infra/cloudfront.tf` の `local.csp` の `connect-src` から `https://*.supabase.co` を削除（Supabase Auth 撤去に伴うクリーンアップ） |

### Phase 3: 既存ユーザーマイグレーション

**方針: アクティブマイグレーションは行わず、自然消滅を待つ**

- 既存 `scores.user_id` は Supabase Auth が発行した UUID 群
- 新環境では Spring Boot 自前発行の別 UUID になる
- 同一プレイヤーであっても**新環境では別ユーザー扱い**
- 引継ぎを希望するプレイヤーは **引継ぎコード機能** で旧 user_id を新環境に持ち込む

理由：
- 強制マイグレーションのコストが見合わない（個人開発・ユーザー数小）
- 旧 user_id を持つレコードはランキング表示には支障なし（read-only として残る）

---

## Open Questions

実装着手時に決定する：

- [ ] `JwtKeyProvider` のリネーム後の正式名（`LocalKeyProvider` / `KeyMaterialProvider` / etc.）
- [ ] CSRF トークン配布方式の詳細（Cookie 経由 vs `/auth/csrf` エンドポイント）
- [ ] `migration_codes` テーブル長期化のスキーマ詳細（V12 マイグレーションファイル）

---

## References

- `auth-token-storage-strategy.md`（撤退判断の根拠）
- `aws_migration_architecture.md`（全体アーキテクチャ）
- `jwks-fetcher-refactor-plan.md`（既存リファクタ計画との統合）
- `backend-mode-resume.md`（バックエンド作業の再開ポイント）
- `iam-deploy-role-manual-management.md`（IAM 周りの負債）
- 既存実装: `typing-api/src/main/java/com/example/demo/filter/JwtKeyProvider.java`
- 既存実装: `typing-api/src/main/java/com/example/demo/filter/JwtAuthenticationFilter.java`
- 既存実装: `typing-api/src/main/java/com/example/demo/migration/MigrationRateLimiter.java`
- 既存実装: `typing-api/src/main/java/com/example/demo/migration/MigrationService.java`
