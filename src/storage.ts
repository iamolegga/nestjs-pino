import { AsyncLocalStorage } from 'async_hooks';
import pino from 'pino';

export class Store {
  constructor(public logger: pino.Logger) {}
}

export const storage = new AsyncLocalStorage<Store>();
