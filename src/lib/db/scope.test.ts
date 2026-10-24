import { describe, expect, it } from "vitest";
import { scopeOperation } from "./scope";

const U = "user_1";

describe("scopeOperation", () => {
  it("adds userId to list reads", () => {
    expect(scopeOperation("findMany", undefined, U)).toEqual({ where: { userId: U } });
    expect(scopeOperation("findMany", { where: { status: "TODO" } }, U)).toEqual({
      where: { AND: [{ status: "TODO" }, { userId: U }] },
    });
  });

  it("keeps unique filters at top level and adds userId", () => {
    expect(scopeOperation("findUnique", { where: { id: "a" } }, U)).toEqual({ where: { id: "a", userId: U } });
    expect(scopeOperation("delete", { where: { id: "a" } }, U)).toEqual({ where: { id: "a", userId: U } });
  });

  it("injects userId on create and createMany", () => {
    expect(scopeOperation("create", { data: { title: "x" } }, U)).toEqual({ data: { title: "x", userId: U } });
    expect(scopeOperation("createMany", { data: [{ a: 1 }, { a: 2 }] }, U)).toEqual({
      data: [
        { a: 1, userId: U },
        { a: 2, userId: U },
      ],
    });
  });

  it("scopes upsert where + create", () => {
    const out = scopeOperation("upsert", { where: { id: "a" }, create: { t: 1 }, update: { t: 2 } }, U);
    expect(out).toEqual({ where: { id: "a", userId: U }, create: { t: 1, userId: U }, update: { t: 2 } });
  });

  it("rejects payloads that try to write another user's id", () => {
    expect(() => scopeOperation("create", { data: { userId: "other" } }, U)).toThrow(/mismatch/);
    expect(() => scopeOperation("update", { where: { id: "a" }, data: { userId: "other" } }, U)).toThrow(/mismatch/);
    expect(() => scopeOperation("updateMany", { data: { userId: "other" } }, U)).toThrow(/mismatch/);
  });

  it("rejects manual user connect", () => {
    expect(() => scopeOperation("create", { data: { user: { connect: { id: "x" } } } }, U)).toThrow(/connect/);
  });

  it("fails closed on unknown operations", () => {
    expect(() => scopeOperation("someFutureOperation", {}, U)).toThrow(/not allowed/);
  });
});
