import { describe, it, expect } from "vitest";
import {
  parseViewParams,
  PAGE_SIZE_OPTIONS,
  Q_MAX_LEN,
} from "@/lib/auditoriaRequestsParams";

const p = (obj: Record<string, string>) =>
  parseViewParams(new URLSearchParams(obj));

describe("parseViewParams - defaults", () => {
  it("returns defaults when no params are provided", () => {
    const r = parseViewParams(new URLSearchParams());
    expect(r).toMatchObject({
      q: "",
      status: "all",
      fn: "all",
      sort: "created_at",
      dir: "desc",
      size: 50,
      page: 1,
      view: null,
      invalid: [],
    });
  });

  it("accepts a plain object as source", () => {
    const r = parseViewParams({ status: "ok", page: "3" });
    expect(r.status).toBe("ok");
    expect(r.page).toBe(3);
  });

  it("accepts a function reader as source and tolerates throws", () => {
    const r = parseViewParams((k) => {
      if (k === "sort") throw new Error("boom");
      if (k === "status") return "error";
      return null;
    });
    expect(r.status).toBe("error");
    expect(r.sort).toBe("created_at");
    expect(r.invalid).not.toContain("sort"); // null reads are not "invalid"
  });
});

describe("parseViewParams - enum whitelists", () => {
  it("accepts valid status values", () => {
    for (const s of ["all", "ok", "error", "started"]) {
      expect(p({ status: s }).status).toBe(s);
    }
  });

  it("drops unknown status and reports it", () => {
    const r = p({ status: "exploded" });
    expect(r.status).toBe("all");
    expect(r.invalid).toContain("status");
  });

  it("drops unknown sort key", () => {
    const r = p({ sort: "drop table" });
    expect(r.sort).toBe("created_at");
    expect(r.invalid).toContain("sort");
  });

  it("accepts asc/desc only for dir", () => {
    expect(p({ dir: "asc" }).dir).toBe("asc");
    expect(p({ dir: "desc" }).dir).toBe("desc");
    const r = p({ dir: "sideways" });
    expect(r.dir).toBe("desc");
    expect(r.invalid).toContain("dir");
  });
});

describe("parseViewParams - integers", () => {
  it("accepts whitelisted page sizes", () => {
    for (const n of PAGE_SIZE_OPTIONS) {
      expect(p({ size: String(n) }).size).toBe(n);
    }
  });

  it("rejects non-whitelisted page sizes", () => {
    const r = p({ size: "37" });
    expect(r.size).toBe(50);
    expect(r.invalid).toContain("size");
  });

  it("rejects non-integer, negative, NaN, and overflow page values", () => {
    for (const bad of ["abc", "-1", "0", "1.5", "1e9", "99999999"]) {
      const r = p({ page: bad });
      expect(r.page).toBe(1);
      expect(r.invalid).toContain("page");
    }
  });

  it("accepts valid page numbers", () => {
    expect(p({ page: "1" }).page).toBe(1);
    expect(p({ page: "42" }).page).toBe(42);
  });
});

describe("parseViewParams - q (search)", () => {
  it("trims whitespace and keeps content", () => {
    expect(p({ q: "  hello  " }).q).toBe("hello");
  });

  it("collapses empty/whitespace to empty string without flagging invalid", () => {
    const r = p({ q: "   " });
    expect(r.q).toBe("");
    expect(r.invalid).not.toContain("q");
  });

  it("caps length at Q_MAX_LEN", () => {
    const long = "x".repeat(Q_MAX_LEN + 50);
    const r = p({ q: long });
    expect(r.q.length).toBe(Q_MAX_LEN);
  });
});

describe("parseViewParams - fn slug", () => {
  it("accepts safe function slugs", () => {
    for (const name of ["avaliacao-wizard-ia", "test_ai_config", "fn1"]) {
      expect(p({ fn: name }).fn).toBe(name);
    }
  });

  it("treats 'all' and empty as default without flagging", () => {
    expect(p({ fn: "all" }).fn).toBe("all");
    expect(p({ fn: "" }).fn).toBe("all");
    expect(p({ fn: "all" }).invalid).not.toContain("fn");
  });

  it("rejects fn with spaces, symbols, or excessive length", () => {
    for (const bad of ["bad name", "drop;table", "../etc", "a".repeat(81)]) {
      const r = p({ fn: bad });
      expect(r.fn).toBe("all");
      expect(r.invalid).toContain("fn");
    }
  });
});

describe("parseViewParams - view name", () => {
  it("returns trimmed view name when present", () => {
    expect(p({ view: "  Erros 24h  " }).view).toBe("Erros 24h");
  });

  it("returns null when missing or empty", () => {
    expect(p({}).view).toBeNull();
    expect(p({ view: "   " }).view).toBeNull();
  });

  it("truncates extremely long view names", () => {
    const r = p({ view: "v".repeat(500) });
    expect(r.view!.length).toBe(120);
  });
});

describe("parseViewParams - aggregate behaviour", () => {
  it("collects multiple invalid params and applies all safe values", () => {
    const r = p({
      q: "  hi  ",
      status: "haxx",
      fn: "bad name",
      sort: "nope",
      dir: "left",
      size: "999",
      page: "-3",
      view: "Shared",
    });
    expect(r).toMatchObject({
      q: "hi",
      status: "all",
      fn: "all",
      sort: "created_at",
      dir: "desc",
      size: 50,
      page: 1,
      view: "Shared",
    });
    expect(r.invalid.sort()).toEqual(
      ["dir", "fn", "page", "size", "sort", "status"].sort(),
    );
  });

  it("does not flag invalid for params that are simply absent", () => {
    expect(p({ q: "anything" }).invalid).toEqual([]);
  });
});
