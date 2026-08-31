import { AsyncLocalStorage } from 'node:async_hooks';

import { Logger } from 'pino';

export class Store {
  constructor(
    public logger: Logger,
    public responseLogger?: Logger,
  ) {}
}

export const storage = new AsyncLocalStorage<Store>();
