import { Options } from 'pino-http';

const LEVEL_MAP: Record<string, string> = {
  trace: 'verbose',
  info: 'log',
};

/**
 * Pino options preset that makes pino's JSON output match the field names and
 * format of NestJS's built-in `ConsoleLogger` in JSON mode.
 *
 * ConsoleLogger JSON: {"level":"log","pid":17580,"timestamp":1765305000999,"message":"Hello World","context":"AppService"}
 *
 * Use together with `NativeLogger` for a full drop-in replacement:
 *
 * ```ts
 * import { NativeLogger, nativeLoggerOptions } from 'nestjs-pino';
 *
 * @Module({ imports: [LoggerModule.forRoot({ pinoHttp: nativeLoggerOptions })] })
 * class AppModule {}
 *
 * const app = await NestFactory.create(AppModule, { bufferLogs: true });
 * app.useLogger(app.get(NativeLogger));
 * ```
 */
export const nativeLoggerOptions: Options = {
  messageKey: 'message',
  timestamp: () => `,"timestamp":${Date.now()}`,
  base: { pid: process.pid },
  formatters: {
    level(label) {
      return { level: LEVEL_MAP[label] || label };
    },
  },
};
