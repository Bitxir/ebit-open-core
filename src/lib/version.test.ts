import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./version";

describe("release version", () => {
  it("matches package.json and the changelog's latest entry", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.version).toBe(APP_VERSION);
    const latest = readFileSync("docs/changelog.md", "utf8").match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
    expect(latest).toBe(APP_VERSION);
  });
});
