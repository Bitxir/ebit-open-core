import { describe, expect, it } from "vitest";
import { oauthReturnPath } from "./oauth-return-path";

describe("OAuth return paths", () => {
  it("preserves the consent ID, query and fragment", () => {
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc#approve")).toBe("/.lovable/oauth/consent?authorization_id=abc#approve");
  });
  it("rejects external redirects and malformed inputs", () => {
    for (const input of ["//outside.invalid", "/\\outside.invalid/", "https://outside.invalid", "/\npath", "/%2f%2foutside.invalid", null]) {
      const result = oauthReturnPath(input);
      expect(new URL(result, "https://app.invalid").origin).toBe("https://app.invalid");
      if (input !== "/%2f%2foutside.invalid") expect(result).toBe("/");
    }
  });
});