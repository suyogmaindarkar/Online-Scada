const serializeError = (error) => ({
  name: error && error.name,
  message: error && error.message,
  stack: error && error.stack,
});

const write = (level, message, fields = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
};

module.exports = {
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields = {}) => write('error', message, {
    ...fields,
    ...(fields.error instanceof Error ? { error: serializeError(fields.error) } : {}),
  }),
};
