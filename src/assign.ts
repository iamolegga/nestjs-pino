import * as pino from 'pino';
import { storage } from './storage';
import { PinoLogger } from './PinoLogger';

/**
 * assign replaces current logger with the child one containing passed fields
 * @param fields
 */
export function assign(fields: pino.Bindings): void {
  const store = storage.getStore();
  if (!store) {
    throw new Error(
      `${PinoLogger.name}: unable to assign extra fields out of request scope`,
    );
  }
  store.logger = store.logger.child(fields);
}
