import chalk from "chalk";

export const TC_PALETTE = {
  primary: "#4473b9",
  accent: "#5b9bd5",
  success: "#2fba6a",
  warn: "#e8a838",
  error: "#d94040",
  muted: "#808080",
  dim: "#5a5a5a",
} as const;

export const theme = {
  primary: chalk.hex(TC_PALETTE.primary),
  accent: chalk.hex(TC_PALETTE.accent),
  success: chalk.hex(TC_PALETTE.success),
  warn: chalk.hex(TC_PALETTE.warn),
  error: chalk.hex(TC_PALETTE.error),
  muted: chalk.hex(TC_PALETTE.muted),
  dim: chalk.hex(TC_PALETTE.dim),
  heading: chalk.bold.hex(TC_PALETTE.primary),
  command: chalk.hex(TC_PALETTE.accent),
  brand: chalk.bold.hex(TC_PALETTE.primary),
  label: chalk.bold,
  value: chalk.white,
};
