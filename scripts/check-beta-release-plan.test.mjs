import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = new URL("./check-beta-release-plan.mjs", import.meta.url);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const changesetDirectory = join(repositoryRoot, ".changeset");
const tc500CorrectionId = "tc-500-share-release-correction";
const tc500Correction = join(changesetDirectory, `${tc500CorrectionId}.md`);

// This assertion only means anything while the TC-500 correction is still a
// pending beta changeset. Pre mode does not delete a consumed changeset; it
// records the id in pre.json and leaves the file on disk until
// `changeset pre exit`, so keying on existence alone would leave the test
// asserting a plan the beta release has already shipped. Mirror
// check-beta-release-plan.mjs and treat an admitted changeset as consumed;
// outside pre mode there is no beta plan to pin at all.
function tc500CorrectionPending() {
  if (!existsSync(tc500Correction)) return false;
  try {
    const pre = JSON.parse(
      readFileSync(join(changesetDirectory, "pre.json"), "utf8"),
    );
    return !pre.changesets?.includes(tc500CorrectionId);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
const major = `---\n"@tinycloud/web-sdk": major\n---\n\nBreaking change.\n`;

async function fixture(preChangesets, extraChangesets = {}) {
  const directory = await mkdtemp(join(tmpdir(), "tinycloud-beta-plan-"));
  await writeFile(
    join(directory, "pre.json"),
    JSON.stringify({ mode: "pre", tag: "beta", changesets: preChangesets }),
  );
  await writeFile(join(directory, "reviewed-major.md"), major);
  for (const [name, source] of Object.entries(extraChangesets))
    await writeFile(join(directory, name), source);
  return directory;
}

test("ignores major changesets already admitted to pre.json", async () => {
  const directory = await fixture(["reviewed-major"]);
  try {
    const result = spawnSync(process.execPath, [script.pathname, directory], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /contains no major bumps/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("still rejects a newly introduced major changeset", async () => {
  const directory = await fixture(["reviewed-major"], {
    "new-major.md": major,
  });
  try {
    const result = spawnSync(process.execPath, [script.pathname, directory], {
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Automatic beta release refuses unconfirmed major bumps/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test(
  "TC-500 release plan includes all five corrected beta versions",
  {
    skip: !tc500CorrectionPending(),
  },
  async () => {
    const outputName = `.changeset/.tc-500-release-plan-${process.pid}.json`;
    const outputPath = join(repositoryRoot, outputName);
    const changesetBin = createRequire(import.meta.url).resolve(
      "@changesets/cli/bin.js",
    );

    try {
      const result = spawnSync(
        process.execPath,
        [changesetBin, "status", `--output=${outputName}`],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
        },
      );
      assert.equal(result.status, 0, result.stderr);

      const plan = JSON.parse(await readFile(outputPath, "utf8"));
      const versions = new Map(
        plan.releases.map(({ name, newVersion }) => [name, newVersion]),
      );
      assert.deepEqual(
        Object.fromEntries(
          [...versions].filter(([name]) =>
            [
              "@tinycloud/node-sdk",
              "@tinycloud/sdk-core",
              "@tinycloud/web-sdk",
              "@tinycloud/share-sdk",
              "@tinycloud/share-envelope",
            ].includes(name),
          ),
        ),
        {
          "@tinycloud/sdk-core": "3.0.0-beta.7",
          "@tinycloud/web-sdk": "3.0.0-beta.7",
          "@tinycloud/share-sdk": "0.3.0-beta.2",
          "@tinycloud/share-envelope": "0.2.1-beta.2",
          "@tinycloud/node-sdk": "3.0.0-beta.7",
        },
      );
    } finally {
      await unlink(outputPath).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
    }
  },
);
