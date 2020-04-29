import { Inject } from '@nestjs/common';

import { decoratedLoggers } from './decorated-loggers';
import { getLoggerToken } from './logger.utils';

export function InjectPinoLogger(context = '') {
  decoratedLoggers.add(context);
  return Inject(getLoggerToken(context));
}
