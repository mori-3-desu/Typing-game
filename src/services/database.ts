// 読み取り系(words.json / ranking JSON)は S3 直接配信を読み、Lambda→RDS を
// 経由しない（aws.md「読み書き非対称化」方針）。
// 書き込み(POST /api/scores, PATCH /api/scores/name)は HttpOnly Cookie 認証
// （credentials: "include"）で API Gateway → Lambda 経由。

import {
  type DifficultyLevel,
  type RankingEntry,
  type RankingScore,
  type ScorePostResult,
  type ScoreRequestBody,
  type Word,
  type WordDataMap,
} from "../types";
import { API_BASE } from "./apiBase";
import { apiFetch } from "./apiFetch";

const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = [
  "EASY",
  "NORMAL",
  "HARD",
  "EXTRA",
] as const;

// fetch で受け取った unknown を WordDataMap として安全に扱う
// words.json は Terraform が RDS から生成する整形済み JSON。自前生成物だが
// 「ネットワーク境界を越えた値は信用せず unknown 起点で検証する」原則に従う。
const isWord = (value: unknown): value is Word => {
  if (typeof value !== "object" || value === null) return false;

  return (
    "jp" in value &&
    typeof value.jp === "string" &&
    "roma" in value &&
    typeof value.roma === "string"
  );
};

const isWordDataMap = (value: unknown): value is WordDataMap => {
  if (typeof value !== "object" || value === null) return false;
  const map = value as Record<string, unknown>;
  return DIFFICULTY_LEVELS.every((level) => {
    const list = map[level];
    return Array.isArray(list) && list.every(isWord);
  });
};

export const DatabaseService = {
  /**
   * ゲーム開始時に必要な単語データを取得
   * Terraform が RDS から生成し S3 に配信する整形済み JSON（/words.json）を読む。
   * 読み取り系は Lambda→RDS を経由しない（aws.md「読み書き非対称化」方針）。
   * NG ワード検証はサーバー側に集約（/api/user/name/validate）。
   */
  async fetchAllGameData(): Promise<{ formattedData: WordDataMap }> {
    const response = await fetch("/words.json");
    if (!response.ok) {
      throw new Error(
        `単語データの取得に失敗しました（HTTP ${response.status}）`,
      );
    }

    const data: unknown = await response.json();
    if (!isWordDataMap(data)) {
      throw new Error("単語データの形式が不正です。");
    }

    // 全難易度が空だとゲームが成立しないので防衛（整形は配信側の責務）
    const hasWords = DIFFICULTY_LEVELS.some((level) => data[level].length > 0);
    if (!hasWords) {
      throw new Error("単語データが空です。");
    }

    return { formattedData: data };
  },

  /**
   * スコア送信（POST /api/scores）
   * HttpOnly Cookie（credentials: "include"）で Spring Boot API に送信
   * サーバー側でハイスコア判定・upsertを行い、自分の行の create_at をかえす
   *
   * @param body 送信するスコアのリクエストボディ
   * @returns 送信結果のステータス情報
   */
  async postScore(body: ScoreRequestBody): Promise<ScorePostResult> {
    const response = await apiFetch(`${API_BASE}/api/scores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Score POST failed: ${response.status}`);
    }

    return (await response.json()) as ScorePostResult;
  },

  /**
   * 全国ランキングを取得(S3 直接配信)
   *
   * @description
   * write-through で生成された /ranking/{difficulty}.json を読む。
   * 対象難易度にまだスコアが無いと JSON 自体が存在しない
   * 404 はエラーではなく空のランキングとして扱う
   */
  async getRanking(
    difficulty: DifficultyLevel,
    signal?: AbortSignal,
  ): Promise<RankingEntry[]> {
    const response = await fetch(`/ranking/${difficulty}.json`, { signal });

    // まだスコアが無い難易度は JSON 自体が存在しない。これは異常ではなく
    // 「空ランキング」という正常な状態なので、エラーにせず空配列を返す。
    if (response.status === 404) return [];

    if (!response.ok) {
      throw new Error(`ranking fetch failed: ${response.status}`);
    }

    // 配列でなければ（HTML フォールバック等）未生成とみなしランキングを返す
    // contains 等の Content-Type 判定に頼らず、受けとった値の形で判断する。
    const data: unknown = await response.json().catch(() => null);

    return Array.isArray(data) ? (data as RankingEntry[]) : [];
  },

  /**
   * 開発者スコアを取得
   * 開発者ランキング（?creator=true）は全国ランキングとは別物なので、
   * 当面 Lambda -> RDS 経路を維持する
   * こちらは別タスクで S3 統一に変更する
   */
  async getDevScore(
    difficulty: DifficultyLevel,
    signal?: AbortSignal,
  ): Promise<RankingScore[]> {
    const response = await fetch(
      `${API_BASE}/api/scores/ranking/${difficulty}?creator=true`,
      {
        signal,
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error status: ${response.status}`);
    }

    return (await response.json()) as RankingScore[];
  },

  /**
   * ユーザー名の登録
   * DBの登録ではないため、ここでは検証が成功したら200を返す
   */
  async validateUserName(initialName: string): Promise<boolean> {
    const response = await apiFetch(`${API_BASE}/api/user/name/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // バックエンドの NameValidationRequest は name フィールドを期待する
      body: JSON.stringify({ name: initialName }),
    });

    if (!response.ok) {
      throw new Error(`name validate failed: ${response.status}`);
    }

    const result = (await response.json()) as { valid: boolean };
    return result.valid;
  },

  /**
   * ユーザー名の更新
   * 名前だけを変更したい場合に使用
   */
  async updateUserName(newName: string): Promise<void> {
    const response = await apiFetch(`${API_BASE}/api/scores/name`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    });

    if (!response.ok) {
      // サーバーの ApiErrorResponse.message を拾う(NG時は「この名前は使用できません」)。
      // 呼び出し側はこの message を画面表示にそのまま使う。
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "名前の変更に失敗しました");
    }
  },
};
