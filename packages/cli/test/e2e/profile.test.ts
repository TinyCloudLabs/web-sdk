/**
 * E2E tests for `tc profile` commands.
 *
 * Profile commands are local file operations — they don't require a running node.
 * They manipulate ~/.tinycloud/profiles/ files.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  tc,
  setupTestProfile,
  cleanupProfile,
  uniqueKey,
  NODE_AVAILABLE,
} from "../helpers";

let tempHome: string;

// Profile tests don't need a running node, but we gate them on NODE_AVAILABLE
// because the test infrastructure (ensureTestSpace) runs at import time.
// If you want to run profile tests standalone, remove the skipIf.
describe.skipIf(!NODE_AVAILABLE)("tc profile", () => {
  beforeAll(async () => {
    tempHome = await setupTestProfile();
  });

  afterAll(async () => {
    if (tempHome) await cleanupProfile(tempHome);
  });

  test("list shows the default profile", async () => {
    const result = await tc(["profile", "list"], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as {
      profiles: Array<{ name: string; active: boolean }>;
      defaultProfile: string;
    };
    expect(data.defaultProfile).toBe("default");
    expect(data.profiles.length).toBeGreaterThanOrEqual(1);
    const defaultProfile = data.profiles.find((p) => p.name === "default");
    expect(defaultProfile).toBeTruthy();
    expect(defaultProfile!.active).toBe(true);
  });

  test("show displays profile details", async () => {
    const result = await tc(["profile", "show"], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as {
      name: string;
      host: string;
      hasKey: boolean;
      hasSession: boolean;
      isDefault: boolean;
    };
    expect(data.name).toBe("default");
    expect(data.hasKey).toBe(true);
    expect(data.hasSession).toBe(true);
    expect(data.isDefault).toBe(true);
  });

  test("create + list + show + delete lifecycle", async () => {
    const name = uniqueKey("prof").slice(0, 12);

    // Create
    const createResult = await tc(
      ["profile", "create", name, "--host", "http://localhost:9999"],
      { tempHome },
    );
    expect(createResult.exitCode).toBe(0);
    const createData = createResult.json() as {
      profile: string;
      created: boolean;
      did: string;
    };
    expect(createData.profile).toBe(name);
    expect(createData.created).toBe(true);
    expect(createData.did).toBeTruthy();

    // List should include new profile
    const listResult = await tc(["profile", "list"], { tempHome });
    expect(listResult.exitCode).toBe(0);
    const listData = listResult.json() as {
      profiles: Array<{ name: string }>;
    };
    expect(listData.profiles.map((p) => p.name)).toContain(name);

    // Show the new profile
    const showResult = await tc(["profile", "show", name], { tempHome });
    expect(showResult.exitCode).toBe(0);
    const showData = showResult.json() as { name: string; host: string };
    expect(showData.name).toBe(name);
    expect(showData.host).toBe("http://localhost:9999");

    // Delete (non-interactive, so no confirmation prompt)
    const deleteResult = await tc(["profile", "delete", name], { tempHome });
    expect(deleteResult.exitCode).toBe(0);
    const deleteData = deleteResult.json() as {
      profile: string;
      deleted: boolean;
    };
    expect(deleteData.profile).toBe(name);
    expect(deleteData.deleted).toBe(true);

    // List should no longer include deleted profile
    const listAfter = await tc(["profile", "list"], { tempHome });
    const afterData = listAfter.json() as {
      profiles: Array<{ name: string }>;
    };
    expect(afterData.profiles.map((p) => p.name)).not.toContain(name);
  });

  test("create duplicate profile fails", async () => {
    const result = await tc(["profile", "create", "default"], { tempHome });
    expect(result.exitCode).not.toBe(0);
  });

  test("switch changes default profile", async () => {
    const name = uniqueKey("sw").slice(0, 10);

    // Create a second profile
    await tc(["profile", "create", name], { tempHome });

    // Switch to it
    const switchResult = await tc(["profile", "switch", name], { tempHome });
    expect(switchResult.exitCode).toBe(0);
    const switchData = switchResult.json() as {
      defaultProfile: string;
      switched: boolean;
    };
    expect(switchData.defaultProfile).toBe(name);
    expect(switchData.switched).toBe(true);

    // List should show it as active
    const listResult = await tc(["profile", "list"], { tempHome });
    const listData = listResult.json() as {
      profiles: Array<{ name: string; active: boolean }>;
      defaultProfile: string;
    };
    expect(listData.defaultProfile).toBe(name);
    const activeProfile = listData.profiles.find((p) => p.active);
    expect(activeProfile?.name).toBe(name);

    // Switch back to default
    await tc(["profile", "switch", "default"], { tempHome });

    // Clean up
    await tc(["profile", "delete", name], { tempHome });
  });

  test("switch to nonexistent profile fails", async () => {
    const result = await tc(["profile", "switch", "nonexistent-profile"], {
      tempHome,
    });
    expect(result.exitCode).not.toBe(0);
  });

  test("delete default profile fails", async () => {
    const result = await tc(["profile", "delete", "default"], { tempHome });
    expect(result.exitCode).not.toBe(0);
  });
});
