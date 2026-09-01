import { DestinationStream, Logger } from 'pino';
import { HttpLogger, pinoHttp } from 'pino-http';

/**
 * These helpers only forward their argument to `pino-http`, so they are
 * deliberately blind to the request, response and custom-level type arguments
 * the caller picked. It cannot be spelled as `Params<any, any, any>['pinoHttp']`
 * either: pino's `onChild` makes two `Logger<CustomLevels>` instantiations
 * mutually non-assignable, so no instantiation is general enough to accept the
 * others.
 */
type PinoHttpParams = object;

/**
 * The one `pino-http` instance of the application, and with it the one pino
 * logger everything else derives from.
 *
 * It used to be built twice: once in the `PinoLogger` constructor, for logs made
 * outside a request, and once by `pino-http` inside the middleware, for logs
 * made inside one. The two were unrelated objects writing to the same
 * destination, so a `transport` was spawned twice, `PinoLogger.root` only ever
 * governed the request half, and an application with no HTTP middleware — a
 * microservice, a standalone script — had no root at all.
 *
 * `pinoHttp()` is just a factory, so nothing requires it to be called from
 * `configure()`. It is called on first use instead, whoever gets there first,
 * and `configure()` mounts that same instance as the middleware.
 */
let middleware: HttpLogger | undefined;

function isDestinationStream(value: unknown): value is DestinationStream {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as DestinationStream).write === 'function'
  );
}

export function ensureLoggerMiddleware(params?: PinoHttpParams): HttpLogger {
  if (!middleware) {
    if (Array.isArray(params)) {
      middleware = pinoHttp(...(params as [any, DestinationStream]));
    } else if (isDestinationStream(params)) {
      middleware = pinoHttp(params);
    } else {
      middleware = pinoHttp(params as any);
    }
  }
  return middleware;
}

export function ensureRootLogger(params?: PinoHttpParams): Logger {
  return ensureLoggerMiddleware(params).logger;
}

export function getRootLogger(): Logger | undefined {
  return middleware?.logger;
}

export function resetRootLogger(): void {
  middleware = undefined;
}
