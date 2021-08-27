import { AsyncLocalStorage } from 'async_hooks';
import { Logger } from 'pino';

export const storage = new AsyncLocalStorage<Logger>();
