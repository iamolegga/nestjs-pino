import { ApplicationConfig } from '@nestjs/core';

/**
 * Whether the installed NestJS supports microservice pre-request hooks, which
 * only exist from v12. The CI matrix also runs on v11, where the specs that
 * need them cannot pass.
 */
export function hasPreRequestHooks(): boolean {
  return (
    typeof (
      new ApplicationConfig() as {
        registerPreRequestHook?: unknown;
      }
    ).registerPreRequestHook === 'function'
  );
}
