export type IssueState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; code: string; expires_at: string }
  | { status: "error"; message: string };

export type ImportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; name: string }
  | { status: "error"; message: string };

export type CopyFeedback = {
  kind: "success" | "error";
  message: string;
};
