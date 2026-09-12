type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type Logger = {
  debug: (msg: string, fields?: Fields) => void;
  info: (msg: string, fields?: Fields) => void;
  warn: (msg: string, fields?: Fields) => void;
  error: (msg: string, fields?: Fields) => void;
  child: (bindings: Fields) => Logger;
};

const serializeError = (value: unknown) =>
  value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value;

/** One JSON object per line on stdout — queryable in CloudWatch Logs Insights without a parser. */
export const createLogger = (
  minLevel: Level = 'info',
  bindings: Fields = {},
  write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
): Logger => {
  const emit = (level: Level, msg: string, fields?: Fields) => {
    if (LEVELS[level] < LEVELS[minLevel]) return;
    const entry: Fields = { level, msg, ts: new Date().toISOString(), ...bindings };
    for (const [key, value] of Object.entries(fields ?? {})) entry[key] = serializeError(value);
    write(JSON.stringify(entry));
  };
  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    child: (more) => createLogger(minLevel, { ...bindings, ...more }, write),
  };
};

export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
};
