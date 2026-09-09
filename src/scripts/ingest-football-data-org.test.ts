import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("ingest:football-data-org CLI", () => {
  it("exits with a controlled error and no HTTP when the token is empty", () => {
    const cwd = fileURLToPath(new URL("../..", import.meta.url));
    const result = spawnSync("pnpm", ["ingest:football-data-org"], {
      encoding: "utf8",
      cwd,
      shell: true,
      env: {
        ...process.env,
        FOOTBALL_DATA_ORG_TOKEN: "",
      },
    });

    assert.equal(result.status, 1);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /FOOTBALL_DATA_ORG_TOKEN is not set/,
    );
    assert.equal(
      `${result.stdout}\n${result.stderr}`.includes("api.football-data.org"),
      false,
    );
  });
});
