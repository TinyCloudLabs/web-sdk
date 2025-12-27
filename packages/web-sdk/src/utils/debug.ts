/**
 * Debug logging utility - logs are stripped in production builds
 */
export const debug = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[TinyCloud]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[TinyCloud]', ...args);
    }
  },
  error: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[TinyCloud]', ...args);
    }
  },
};
