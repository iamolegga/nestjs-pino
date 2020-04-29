import * as pino from 'pino';

export type PassedLogger = { logger: pino.Logger };

export function isPassedLogger(
  pinoHttpProp: any,
): pinoHttpProp is PassedLogger {
  return !!pinoHttpProp && 'logger' in pinoHttpProp;
}
