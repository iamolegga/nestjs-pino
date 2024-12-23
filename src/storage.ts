import { AsyncLocalStorage } from 'async_hooks';

import { Logger } from 'pino';

export class Store {
  constructor(
    public logger: Logger,
    public responseLogger?: Logger,
  ) {}
}

export const storage = new AsyncLocalStorage<Store>();
