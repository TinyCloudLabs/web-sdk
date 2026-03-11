import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ProfileManager } from "../config/profiles.js";
import { outputJson, withSpinner, shouldOutputJson, formatTable, formatBytes } from "../output/formatter.js";
import { handleError, CLIError } from "../output/errors.js";
import { ExitCode } from "../config/constants.js";
import { ensureAuthenticated } from "../lib/sdk.js";
import { theme } from "../output/theme.js";

export function registerSqlCommand(program: Command): void {
  const sql = program.command("sql").description("SQL database operations");

  // tc sql query <sql>
  sql
    .command("query <sql>")
    .description("Run a SELECT query")
    .option("--db <name>", "Database name", "default")
    .option("--params <json>", "Bind parameters as JSON array")
    .action(async (sqlStr: string, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const node = await ensureAuthenticated(ctx);

        const params = options.params ? JSON.parse(options.params) : undefined;

        const result = await withSpinner("Running query...", () =>
          node.sql.db(options.db).query(sqlStr, params)
        ) as any;

        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        const { columns, rows, rowCount } = result.data;

        if (shouldOutputJson()) {
          outputJson({ columns, rows, rowCount });
        } else {
          if (rows.length === 0) {
            process.stdout.write(theme.muted("No rows returned.") + "\n");
          } else {
            const stringRows = rows.map((row: unknown[]) =>
              row.map((v: unknown) => v === null ? "NULL" : String(v))
            );
            process.stdout.write(formatTable(columns, stringRows) + "\n");
            process.stdout.write(theme.muted(`\n${rowCount} row${rowCount === 1 ? "" : "s"} returned`) + "\n");
          }
        }
      } catch (error) {
        handleError(error);
      }
    });

  // tc sql execute <sql>
  sql
    .command("execute <sql>")
    .description("Run INSERT/UPDATE/DELETE/DDL statement")
    .option("--db <name>", "Database name", "default")
    .option("--params <json>", "Bind parameters as JSON array")
    .action(async (sqlStr: string, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const node = await ensureAuthenticated(ctx);

        const params = options.params ? JSON.parse(options.params) : undefined;

        const result = await withSpinner("Executing statement...", () =>
          node.sql.db(options.db).execute(sqlStr, params)
        ) as any;

        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        outputJson({
          changes: result.data.changes,
          lastInsertRowId: result.data.lastInsertRowId,
        });
      } catch (error) {
        handleError(error);
      }
    });

  // tc sql export
  sql
    .command("export")
    .description("Export database as binary file")
    .option("--db <name>", "Database name", "default")
    .option("-o, --output <file>", "Output file path", "export.db")
    .action(async (options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const node = await ensureAuthenticated(ctx);

        const result = await withSpinner("Exporting database...", () =>
          node.sql.db(options.db).export()
        ) as any;

        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        const blob: Blob = result.data;
        const buffer = Buffer.from(await blob.arrayBuffer());
        const outputPath = resolve(options.output);
        await writeFile(outputPath, buffer);

        outputJson({
          file: outputPath,
          size: blob.size,
          sizeHuman: formatBytes(blob.size),
        });
      } catch (error) {
        handleError(error);
      }
    });
}
