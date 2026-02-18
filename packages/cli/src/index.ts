import { Command } from "commander";
import { handleError } from "./output/errors.js";
import { registerInitCommand } from "./commands/init.js";
import { registerAuthCommand } from "./commands/auth.js";
import { registerKvCommand } from "./commands/kv.js";
import { registerSpaceCommand } from "./commands/space.js";
import { registerDelegationCommand } from "./commands/delegation.js";
import { registerShareCommand } from "./commands/share.js";
import { registerNodeCommand } from "./commands/node.js";
import { registerProfileCommand } from "./commands/profile.js";
import { registerCompletionCommand } from "./commands/completion.js";

const program = new Command();

program
  .name("tc")
  .description("TinyCloud CLI")
  .version("0.1.0")
  .option("-p, --profile <name>", "Profile to use")
  .option("-H, --host <url>", "TinyCloud node URL")
  .option("-v, --verbose", "Enable verbose output")
  .option("--no-cache", "Disable caching")
  .option("-q, --quiet", "Suppress non-essential output");

registerInitCommand(program);
registerAuthCommand(program);
registerKvCommand(program);
registerSpaceCommand(program);
registerDelegationCommand(program);
registerShareCommand(program);
registerNodeCommand(program);
registerProfileCommand(program);
registerCompletionCommand(program);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  handleError(error);
}
