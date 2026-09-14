import { ExecutionContext } from '@nestjs/common';

/**
 * Read reflectively rather than imported, so that `@nestjs/microservices` stays
 * a dependency of the *application* and never of this package. These keys are
 * part of the metadata `@MessagePattern` and `@EventPattern` write, and are
 * stable across NestJS 11 and 12.
 */
const PATTERN_METADATA = 'microservices:pattern';
const PATTERN_HANDLER_METADATA = 'microservices:handler_type';
const TRANSPORT_METADATA = 'microservices:transport';

/** `PatternHandler.EVENT`; `MESSAGE` is 1. */
const EVENT_HANDLER = 2;

/** Indexed by the `Transport` enum, for the rare handler that pins one. */
const TRANSPORT_NAMES = [
  'tcp',
  'redis',
  'nats',
  'mqtt',
  'grpc',
  'rmq',
  'kafka',
];

const CONTEXT_SUFFIX = 'Context';

export type RpcType = 'message' | 'event';

/**
 * What is known about the message being handled. This is also what is logged
 * under the `rpc` key, apart from the payload, which `includePayload` adds.
 */
export interface RpcInfo {
  /**
   * `'message'` for `@MessagePattern`, where the caller is waiting for a reply,
   * `'event'` for `@EventPattern`, where nobody is.
   */
  type: RpcType;

  /** The pattern the handler is registered for, as given to the decorator. */
  pattern: string | number | symbol | Record<string, unknown> | undefined;

  /** Lowercased transport name, e.g. `'rmq'`, `'kafka'`, `'tcp'`. */
  transport: string | undefined;

  controller: string;

  handler: string;
}

type StaticRpcInfo = Pick<RpcInfo, 'type' | 'pattern' | 'transport'>;

// The pattern and the kind are fixed for a handler method, so they are read
// once instead of on every message.
const staticInfoCache = new WeakMap<(...args: any[]) => any, StaticRpcInfo>();

function readStaticInfo(
  handler: ((...args: any[]) => any) | undefined,
): StaticRpcInfo {
  if (!handler || typeof Reflect.getMetadata !== 'function') {
    return { type: 'message', pattern: undefined, transport: undefined };
  }

  const patterns = Reflect.getMetadata(PATTERN_METADATA, handler);
  const kind = Reflect.getMetadata(PATTERN_HANDLER_METADATA, handler);
  const transport = Reflect.getMetadata(TRANSPORT_METADATA, handler);

  return {
    // A handler with no metadata at all is not necessarily a mistake — a custom
    // transport strategy can register one — so it is reported as a message,
    // which is both the more common kind and the safer default.
    type: kind === EVENT_HANDLER ? 'event' : 'message',
    pattern: Array.isArray(patterns)
      ? patterns.length > 1
        ? patterns
        : patterns[0]
      : patterns,
    transport:
      typeof transport === 'number' ? TRANSPORT_NAMES[transport] : undefined,
  };
}

/**
 * The transport a message actually arrived on, taken from the class of the
 * per-message context — `RmqContext`, `KafkaContext`, `TcpContext` and so on.
 * More reliable than the decorator metadata, which is only set when a handler
 * explicitly pins a transport.
 */
function readTransport(context: ExecutionContext): string | undefined {
  let rpcContext: unknown;
  try {
    rpcContext = context.switchToRpc().getContext();
  } catch {
    return undefined;
  }

  const name = (rpcContext as { constructor?: { name?: string } })?.constructor
    ?.name;
  if (
    typeof name !== 'string' ||
    name === CONTEXT_SUFFIX ||
    !name.endsWith(CONTEXT_SUFFIX)
  ) {
    return undefined;
  }
  return name.slice(0, -CONTEXT_SUFFIX.length).toLowerCase();
}

/**
 * Describes the message a microservice handler was called with.
 *
 * Every callback of the `microservice` parameters receives an `ExecutionContext`
 * and nothing else, the way `pino-http`'s callbacks receive the request, so
 * this is how they reach the pattern, the transport and — most usefully — the
 * `type`, to tell a `@MessagePattern` from an `@EventPattern`:
 *
 * ```ts
 * customLogLevel: (ctx, err) =>
 *   err ? 'error' : getRpcInfo(ctx).type === 'event' ? 'debug' : 'info',
 * ```
 *
 * Never throws: a context it cannot read reports a message with no pattern.
 */
export function getRpcInfo(context: ExecutionContext): RpcInfo {
  const handler = context.getHandler?.() as
    | ((...args: any[]) => any)
    | undefined;

  let staticInfo = handler && staticInfoCache.get(handler);
  if (!staticInfo) {
    staticInfo = readStaticInfo(handler);
    if (handler) {
      staticInfoCache.set(handler, staticInfo);
    }
  }

  return {
    type: staticInfo.type,
    pattern: staticInfo.pattern,
    transport: readTransport(context) ?? staticInfo.transport,
    controller: context.getClass?.()?.name ?? '',
    handler: handler?.name ?? '',
  };
}
