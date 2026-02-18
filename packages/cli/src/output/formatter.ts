import ora from "ora";

export function outputJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function outputError(code: string, message: string): void {
  process.stderr.write(
    JSON.stringify({ error: { code, message } }, null, 2) + "\n"
  );
}

export function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY);
}

export async function withSpinner<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!isInteractive()) {
    return fn();
  }
  const spinner = ora(label).start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
