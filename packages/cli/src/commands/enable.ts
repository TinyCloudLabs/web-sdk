import { Command } from "commander";
import { ensureShareDeviceAuthorization } from "../auth/device-auth.js";
import { ProfileManager } from "../config/profiles.js";
import { handleError } from "../output/errors.js";
import { output } from "../output/formatter.js";

export function registerEnableCommand(program: Command): void {
  const enable = program.command("enable").description("Enable a narrowly scoped TinyCloud service");

  enable.command("share")
    .description("Approve Share publishing through OpenKey device authorization")
    .action(async (_options, command) => {
      try {
        const context = await ProfileManager.resolveContext(command.optsWithGlobals());
        const result = await ensureShareDeviceAuthorization({
          profileName: context.profile,
          nodeOrigin: context.host,
          shareOrigin: "https://share.tinycloud.xyz",
          openkeyHost: process.env.TC_OPENKEY_HOST,
          allowReplaceLocal: true,
        });
        const value = {
          enabled: true,
          service: "share",
          profile: context.profile,
          sessionDid: result.profile.sessionDid ?? result.profile.did,
          expiresAt: result.delegation.expiresAt ?? result.delegation.expirationTime ?? result.delegation.expiry,
        };
        output(value, () => `Share enabled for profile ${context.profile}.`);
      } catch (error) {
        handleError(error);
      }
    });
}
