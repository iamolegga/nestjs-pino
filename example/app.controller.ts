import { Controller, Get, Logger } from "@nestjs/common";
import { MyService } from "./my.service";
import { InjectPinoLogger, PinoLogger } from "../src";

@Controller()
export class AppController {
  // Choose which one do you like more: usage of builtin logger that implements
  // `LoggerService` (verbose?,debug?,log,warn,error) or ...
  private readonly builtInLogger = new Logger(AppController.name);

  constructor(
    private readonly myService: MyService,
    // ... logger that implements `pino` (trace,debug,info,warn,error,fatal).
    // For the last one you can choose which of this two injection methods do
    // you like more:
    @InjectPinoLogger(AppController.name) private readonly pinoLogger1: PinoLogger,
    private readonly pinoLogger2: PinoLogger,
  ) {
    pinoLogger2.setContext(AppController.name);
  }

  @Get()
  getHello(): string {
    this.builtInLogger.verbose({ foo: 'bar' }, 'baz %s', 'qux'); // will be skipped because debug level is set
    this.builtInLogger.debug({ foo: 'bar' }, 'baz %s', 'qux');
    this.builtInLogger.log({ foo: 'bar' }, 'baz %s', 'qux');
    this.builtInLogger.warn({ foo: 'bar' }, 'baz %s', 'qux');
    this.builtInLogger.error({ foo: 'bar' }, 'baz %s', 'qux');

    this.pinoLogger1.trace({ foo: 'bar' }, 'baz %s', 'qux'); // will be skipped because debug level is set
    this.pinoLogger1.debug({ foo: 'bar' }, 'baz %s', 'qux');
    this.pinoLogger1.info({ foo: 'bar' }, 'baz %s', 'qux');
    this.pinoLogger1.warn({ foo: 'bar' }, 'baz %s', 'qux');
    this.pinoLogger1.error({ foo: 'bar' }, 'baz %s', 'qux');
    this.pinoLogger1.fatal({ foo: 'bar' }, 'baz %s', 'qux');

    this.pinoLogger2.trace({ foo: 'bar' }, 'baz %s', 'qux'); // will be skipped because debug level is set
    this.pinoLogger2.debug({ foo: 'bar' }, 'baz %s', 'qux');
    this.pinoLogger2.info({ foo: 'bar' }, 'baz %s', 'qux');
    this.pinoLogger2.warn({ foo: 'bar' }, 'baz %s', 'qux');
    this.pinoLogger2.error({ foo: 'bar' }, 'baz %s', 'qux');
    this.pinoLogger2.fatal({ foo: 'bar' }, 'baz %s', 'qux');

    return `Hello ${this.myService.getWorld()}`;
  }
}
