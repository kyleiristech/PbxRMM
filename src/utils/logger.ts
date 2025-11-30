import pino from 'pino';

const level = (process.env.LOG_LEVEL ?? 'info').toLowerCase();

export const logger = pino({
  level,
  redact: {
    paths: ['req.headers.authorization']
  }
});
