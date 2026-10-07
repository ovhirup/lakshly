import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Guards the schema contract: the two TS copies must be identical, and the checked-in copy must be what the generator emits today.
const webCopy = new URL("../lib/schema.gen.ts", import.meta.url);
const parsersCopy = new URL("../../../packages/parsers/src/schema.gen.ts", import.meta.url);

describe("schema.gen.ts drift", () => {
  it("web and parsers copies are byte-identical", () => {
    expect(readFileSync(parsersCopy, "utf8")).toBe(readFileSync(webCopy, "utf8"));
  });

  it("the checked-in copy equals fresh generator output", () => {
    const out = join(mkdtempSync(join(tmpdir(), "lakshly-schema-")), "schema.gen.ts");
    execFileSync(
      "npx",
      ["json2ts", "-i", "../../packages/schema/lakshly.schema.json", "-o", out, "--bannerComment", "/* Generated from packages/schema/lakshly.schema.json. Do not edit. */"],
      { cwd: new URL("..", import.meta.url).pathname, stdio: "pipe" },
    );
    expect(readFileSync(out, "utf8")).toBe(readFileSync(webCopy, "utf8"));
  }, 60_000);
});
