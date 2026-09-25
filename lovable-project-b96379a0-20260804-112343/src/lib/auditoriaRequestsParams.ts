// Pure parsing/validation helpers for the shared-view query params used by
// /auditoria-requests. Extracted so we can unit-test the rules in isolation.

export const VALID_SORT_KEYS = [
  "created_at",
  "function_name",
  "status",
  "request_id",
] as const;
export type SortKey = (typeof VALID_SORT_KEYS)[number];

export const VALID_SORT_DIRS = ["asc", "desc"] as const;
export type SortDir = (typeof VALID_SORT_DIRS)[number];

export const VALID_STATUS = ["all", "ok", "error", "started"] as const;
export type StatusFilter = (typeof VALID_STATUS)[number];

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
export const FN_NAME_RE = /^[a-zA-Z0-9_-]{1,80}$/;
export const Q_MAX_LEN = 200;
export const PAGE_MAX = 100000;

export interface ParsedViewParams {
  q: string;
  status: StatusFilter;
  fn: string; // "all" or a function slug matching FN_NAME_RE
  sort: SortKey;
  dir: SortDir;
  size: (typeof PAGE_SIZE_OPTIONS)[number];
  page: number;
  view: string | null;
  invalid: string[]; // names of params that were dropped/coerced to defaults
}

type ParamSource =
  | URLSearchParams
  | Record<string, string | null | undefined>
  | ((key: string) => string | null | undefined);

function makeReader(src: ParamSource): (key: string) => string | null {
  if (typeof src === "function") {
    return (k) => {
      try {
        const v = src(k);
        return v == null ? null : String(v);
      } catch {
        return null;
      }
    };
  }
  if (src instanceof URLSearchParams) {
    return (k) => {
      try { return src.get(k); } catch { return null; }
    };
  }
  return (k) => {
    const v = (src as Record<string, string | null | undefined>)[k];
    return v == null ? null : String(v);
  };
}

export function parseViewParams(src: ParamSource): ParsedViewParams {
  const get = makeReader(src);
  const invalid: string[] = [];

  const pickEnum = <T extends string>(
    key: string,
    allowed: readonly T[],
    fallback: T,
  ): T => {
    const raw = get(key);
    if (raw === null) return fallback;
    if ((allowed as readonly string[]).includes(raw)) return raw as T;
    invalid.push(key);
    return fallback;
  };

  const pickInt = (
    key: string,
    allowed: readonly number[] | null,
    fallback: number,
    min = 1,
    max = PAGE_MAX,
  ): number => {
    const raw = get(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
      invalid.push(key);
      return fallback;
    }
    if (allowed && !allowed.includes(n)) {
      invalid.push(key);
      return fallback;
    }
    return n;
  };

  const q = (() => {
    const raw = get("q");
    if (raw === null) return "";
    const trimmed = raw.trim();
    if (trimmed === "") return "";
    return trimmed.slice(0, Q_MAX_LEN);
  })();

  const fn = (() => {
    const raw = get("fn");
    if (raw === null || raw === "" || raw === "all") return "all";
    if (!FN_NAME_RE.test(raw)) {
      invalid.push("fn");
      return "all";
    }
    return raw;
  })();

  const view = (() => {
    const raw = get("view");
    if (raw === null) return null;
    const trimmed = raw.trim().slice(0, 120);
    return trimmed === "" ? null : trimmed;
  })();

  return {
    q,
    status: pickEnum("status", VALID_STATUS, "all"),
    fn,
    sort: pickEnum("sort", VALID_SORT_KEYS, "created_at"),
    dir: pickEnum("dir", VALID_SORT_DIRS, "desc"),
    size: pickInt(
      "size",
      PAGE_SIZE_OPTIONS as unknown as readonly number[],
      50,
    ) as ParsedViewParams["size"],
    page: pickInt("page", null, 1, 1, PAGE_MAX),
    view,
    invalid,
  };
}
