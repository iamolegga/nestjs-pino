import { Inject, Provider, Scope } from '@nestjs/common';
import { INQUIRER } from '@nestjs/core';
import { PinoLogger } from './PinoLogger';

const decoratedTokenPrefix = 'PinoLogger:';

const decoratedLoggers = new Set<string>();
const transientToken = getLoggerToken('');

export function InjectPinoLogger(context = '') {
  decoratedLoggers.add(context);
  return Inject(getLoggerToken(context));
}

function createDecoratedLoggerProvider(context: string): Provider<PinoLogger> {
  if (context === '') {
    return {
      provide: transientToken,
      useFactory: (logger: PinoLogger, inquirer: any) => {
        if (!inquirer) {
          return logger;
        }
        if (typeof inquirer === 'string') {
          logger.setContext(inquirer);
        } else if (typeof inquirer === 'object') {
          logger.setContext(inquirer.constructor.name);
        }
        return logger;
      },
      inject: [PinoLogger, INQUIRER],
      scope: Scope.TRANSIENT,
    };
  }
  return {
    provide: getLoggerToken(context),
    useFactory: (logger: PinoLogger) => {
      logger.setContext(context);
      return logger;
    },
    inject: [PinoLogger],
  };
}

export function createProvidersForDecorated(): Array<Provider<PinoLogger>> {
  return [...decoratedLoggers.values()].map(createDecoratedLoggerProvider);
}

export function getLoggerToken(context: string): string {
  return `${decoratedTokenPrefix}${context}`;
}
