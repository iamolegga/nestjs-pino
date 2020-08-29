<p align="center">
  <img alt="NestJS-Pino logo" src="https://raw.githubusercontent.com/iamolegga/nestjs-pino/master/logo.png"/>
</p>

<h1 align="center">NestJS-Pino</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/nestjs-pino">
    <img alt="npm" src="https://img.shields.io/npm/v/nestjs-pino" />
  </a>
  <a href="https://travis-ci.org/iamolegga/nestjs-pino">
    <img alt="Travis (.org)" src="https://img.shields.io/travis/iamolegga/nestjs-pino" />
  </a>
  <a href="https://coveralls.io/github/iamolegga/nestjs-pino?branch=master">
    <img alt="Coverage Status" src="https://coveralls.io/repos/github/iamolegga/nestjs-pino/badge.svg?branch=master" />
  </a>
  <a href="https://snyk.io/test/github/iamolegga/nestjs-pino">
    <img alt="Snyk Vulnerabilities for npm package" src="https://img.shields.io/snyk/vulnerabilities/npm/nestjs-pino" />
  </a>
  <img alt="David" src="https://img.shields.io/david/iamolegga/nestjs-pino">
  <img alt="Dependabot" src="https://badgen.net/dependabot/iamolegga/nestjs-pino/?icon=dependabot">
  <img alt="Supported platforms: Express & Fastify" src="https://img.shields.io/badge/platforms-Express%20%26%20Fastify-green" />
</p>

<p align="center">✨✨✨ Platform agnostic logger for NestJS based on Pino with <b>REQUEST CONTEXT IN EVERY LOG</b> ✨✨✨</p>

## Example

Import module with `LoggerModule.forRoot(...)` or `LoggerModule.forRootAsync(...)`:

```ts
import { LoggerModule } from "nestjs-pino";

@Module({
  imports: [LoggerModule.forRoot()],
  controllers: [AppController],
  providers: [MyService]
})
class MyModule {}
```

### Logger

In controller let's use `Logger` - class with the same API as [built-in NestJS logger](https://docs.nestjs.com/techniques/logger):

```ts
import { Logger } from "nestjs-pino";

@Controller()
export class AppController {
  constructor(
    private readonly myService: MyService,
    private readonly logger: Logger
  ) {}

  @Get()
  getHello(): string {
    // pass message
    this.logger.log("getHello()");

    // also we can pass context
    this.logger.log("getHello()", AppController.name);

    return `Hello ${this.myService.getWorld()}`;
  }
}
```

### PinoLogger

Let's compare it to another one logger - `PinoLogger`, it has same _logging_ API as `pino` instance.

For example in service it will be used instead of previous one:

```ts
import { PinoLogger } from "nestjs-pino";

@Injectable()
export class MyService {
  constructor(private readonly logger: PinoLogger) {}

  getWorld(...params: any[]) {
    this.logger.info({ context: MyService.name }, "getWorld(%o)", params);
    return "World!";
  }
}
```

Also context can be set just once in `constructor` instead of every call:

```ts
import { PinoLogger } from "nestjs-pino";

@Injectable()
export class MyService {
  constructor(private readonly logger: PinoLogger) {
    logger.setContext(MyService.name);
  }

  getWorld(...params: any[]) {
    this.logger.info("getWorld(%o)", params);
    return "World!";
  }
}
```

Also context can be set at injection via decorator `@InjectPinoLogger(...)`:

```ts
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";

@Injectable()
export class MyService {
  constructor(
    @InjectPinoLogger(MyService.name) private readonly logger: PinoLogger
  ) {}

  getWorld(...params: any[]) {
    this.logger.info("getWorld(%o)", params);
    return "World!";
  }
}
```

### Using as NestJS app logger

`Logger` can be set as app logger, as it is compatible with [built-in NestJS logger](https://docs.nestjs.com/techniques/logger).
According to [official docs](https://docs.nestjs.com/techniques/logger#dependency-injection), loggers with Dependency injection should be set via following construction:

```ts
import { Logger } from "nestjs-pino";

const app = await NestFactory.create(
  AppModule,
  // You can disable the default logger here until PinoLogger is initialized.
  // But be mindful that logs emitted before you call app.useLogger
  // will not be outputted anywhere.
  // If you don't mind some of your initial logs to be in a non-json format,
  // it is better to simply leave default logger as is, and just
  // override it on the next line with app.useLogger
  { logger: false }
);
app.useLogger(app.get(Logger));
```

Output:

```json
// Logs by app itself
{"level":30,"time":1570470154387,"pid":17383,"hostname":"my-host","context":"RoutesResolver","msg":"AppController {/}: true","v":1}
{"level":30,"time":1570470154391,"pid":17383,"hostname":"my-host","context":"RouterExplorer","msg":"Mapped {/, GET} route true","v":1}
{"level":30,"time":1570470154405,"pid":17383,"hostname":"my-host","context":"NestApplication","msg":"Nest application successfully started true","v":1}

// Logs by injected Logger and PinoLogger in Services/Controllers
// Every log has it's request data and unique `req.id` (per process)
{"level":30,"time":1570470161805,"pid":17383,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","headers":{...},"remoteAddress":"::1","remotePort":53957},"context":"AppController","msg":"getHello()","v":1}
{"level":30,"time":1570470161805,"pid":17383,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","headers":{...},"remoteAddress":"::1","remotePort":53957},"context":"MyService","msg":"getWorld([])","v":1}

// Automatic logs of every request/response
{"level":30,"time":1570470161819,"pid":17383,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","headers":{...},"remoteAddress":"::1","remotePort":53957},"res":{"statusCode":304,"headers":{...}},"responseTime":15,"msg":"request completed","v":1}
```

If you set up `nestjs-pino` as an app logger, you can instantiate it in your services via `Logger` singleton from `@nestjs/common`.
See more info about this way in [this Stack Overflow answer](https://stackoverflow.com/a/52907695/4601673).

```ts
import { Logger } from "@nestjs/common";

@Injectable()
export class MyService {
  logger = new Logger(MyService.name);

  getWorld(...params: any[]) {
    this.logger.log('You can log string message');
    this.logger.log({
      msg: 'Or an object',
      with: 'additional keys'
    });
    return "World!";
  }
}
``` 

## Comparison with others

There are other Nestjs loggers. The key purposes of this module are:

- to be compatible with built-in `LoggerService`
- to log with JSON (thanks to `pino` - [super fast logger](https://github.com/pinojs/pino/blob/master/docs/benchmarks.md)) ([why JSON?](https://jahed.dev/2018/07/05/always-log-to-json/))
- to log every request/response automatically (thanks to `pino-http`)
- to bind request data to the logs automatically from any service on any application layer without passing request context
- to have another one alternative `PinoLogger` for experienced `pino` users for more comfortable usage.

| Logger             | Nest App logger | Logger service | Autobind request data to logs |
| ------------------ | :-------------: | :------------: | :---------------------------: |
| nest-morgan        |        -        |       -        |               -               |
| nest-winston       |        +        |       +        |               -               |
| nestjs-pino-logger |        +        |       +        |               -               |
| **nestjs-pino**    |        +        |       +        |               +               |

## Install

```sh
npm i nestjs-pino
```

## Register module

### Zero configuration

Just import `LoggerModule` to your module:

```ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [LoggerModule.forRoot()],
  ...
})
class MyModule {}
```

### Configuration params

`nestjs-pino` can be configured with params object of next interface:

```ts
interface Params {
  /**
   * Optional parameters for `pino-http` module
   * @see https://github.com/pinojs/pino-http#pinohttpopts-stream
   */
  pinoHttp?:
    | pinoHttp.Options
    | DestinationStream
    | [pinoHttp.Options, DestinationStream];

  /**
   * Optional parameter for routing. It should implement interface of
   * parameters of NestJS buil-in `MiddlewareConfigProxy['forRoutes']`.
   * @see https://docs.nestjs.com/middleware#applying-middleware
   * It can be used for disabling automatic req/res logs (see above).
   * Keep in mind that it will remove context data from logs that are called
   * inside not included or excluded routes and controlles.
   */
  forRoutes?: Parameters<MiddlewareConfigProxy["forRoutes"]>;

  /**
   * Optional parameter for routing. It should implement interface of
   * parameters of NestJS buil-in `MiddlewareConfigProxy['exclude']`.
   * @see https://docs.nestjs.com/middleware#applying-middleware
   * It can be used for disabling automatic req/res logs (see above).
   * Keep in mind that it will remove context data from logs that are called
   * inside not included or excluded routes and controlles.
   */
  exclude?: Parameters<MiddlewareConfigProxy["exclude"]>;

  /**
   * Optional parameter to skip `pino` configuration in case you are using
   * Fastify adapter, and already configuring it on adapter level.
   * Pros and cons of this approach are descibed in the last section.
   */
  useExisting?: true;

  /**
   * Optional parameter to change property name `context` in resulted logs,
   * so logs will be like:
   * {"level":30, ... "RENAME_CONTEXT_VALUE_HERE":"AppController" }
   * Works with both `Logger` and `PinoLogger`
   */
  renameContext?: string;
}
```

### Synchronous configuration

Use `LoggerModule.forRoot` method with argument of [Params interface](#configuration-params):

```ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: [
        {
          name: 'add some name to every JSON line',
          level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
          prettyPrint: process.env.NODE_ENV !== 'production',
          useLevelLabels: true,
          // and all the others...
        },
        someWritableStream
      ],
      forRoutes: [MyController],
      exclude: [{ method: RequestMethod.ALL, path: "check" }]
    })
  ],
  ...
})
class MyModule {}
```

### Asynchronous configuration

With `LoggerModule.forRootAsync` you can, for example, import your `ConfigModule` and inject `ConfigService` to use it in `useFactory` method.

`useFactory` should return object with [Params interface](#configuration-params) or undefined

Here's an example:

```ts
import { LoggerModule } from 'nestjs-pino';

@Injectable()
class ConfigService {
  public readonly level = "debug";
}

@Module({
  providers: [ConfigService],
  exports: [ConfigService]
})
class ConfigModule {}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        await somePromise();
        return {
          pinoHttp: { level: config.level },
        };
      }
    })
  ],
  ...
})
class TestModule {}
```

Or you can just pass `ConfigService` to `providers`, if you don't have any `ConfigModule`:

```ts
import { LoggerModule } from "nestjs-pino";

@Injectable()
class ConfigService {
  public readonly level = "debug";
  public readonly stream = stream;
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      providers: [ConfigService],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          pinoHttp: [{ level: config.level }, config.stream]
        };
      }
    })
  ],
  controllers: [TestController]
})
class TestModule {}
```

### Extreme mode

> In essence, `extreme` mode enables even faster performance by Pino.

Please, read [pino extreme mode docs](https://github.com/pinojs/pino/blob/master/docs/extreme.md#extreme-mode) first. There is a risk of some logs being lost, but you can [minimize it](https://github.com/pinojs/pino/blob/master/docs/extreme.md#log-loss-prevention).

If you know what you're doing, you can enable it like so:

```ts
import * as pino from 'pino';
import { LoggerModule } from 'nestjs-pino';

const dest = pino.extreme();
const logger = pino(dest);

@Module({
  imports: [LoggerModule.forRoot({ pinoHttp: { logger } })],
  ...
})
class MyModule {}
```

## Usage as Logger service

As it said before, there are 2 logger classes:

- `Logger` - implements standard NestJS `LoggerService` interface. So if you are familiar with [built-in NestJS logger](https://docs.nestjs.com/techniques/logger), you are good to go.
- `PinoLogger` - implements standard `pino` _logging_ methods: [trace](https://github.com/pinojs/pino/blob/master/docs/api.md#loggertracemergingobject-message-interpolationvalues), [debug](https://github.com/pinojs/pino/blob/master/docs/api.md#loggerdebugmergingobject-message-interpolationvalues), [info](https://github.com/pinojs/pino/blob/master/docs/api.md#loggerinfomergingobject-message-interpolationvalues), [warn](https://github.com/pinojs/pino/blob/master/docs/api.md#loggerwarnmergingobject-message-interpolationvalues), [error](https://github.com/pinojs/pino/blob/master/docs/api.md#loggererrormergingobject-message-interpolationvalues), [fatal](https://github.com/pinojs/pino/blob/master/docs/api.md#loggerfatalmergingobject-message-interpolationvalues). So if you are familiar with it, you are also good to go.

### Logger

```ts
// my.service.ts
import { Logger } from "nestjs-pino";

@Injectable()
export class MyService {
  constructor(private readonly logger: Logger) {}

  getWorld(...params: any[]) {
    this.logger.log("getWorld(%o)", MyService.name, params);
    return "World!";
  }
}
```

### PinoLogger

See [pino logging method parameters](https://github.com/pinojs/pino/blob/master/docs/api.md#logging-method-parameters) for more logging examples.

```ts
// my.service.ts
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";

@Injectable()
export class MyService {
  // regular injecting
  constructor(private readonly logger: PinoLogger) {}

  // regular injecting and set context
  constructor(private readonly logger: PinoLogger) {
    logger.setContext(MyService.name);
  }

  // inject and set context via `InjectPinoLogger`
  constructor(
    @InjectPinoLogger(MyService.name) private readonly logger: PinoLogger
  ) {}

  getWorld(...params: any[]) {
    this.logger.info("getWorld(%o)", params);
    return "World!";
  }
}
```

#### Testing a class that uses @InjectPinoLogger

This package exposes a getLoggerToken() function that returns a prepared injection token based on the provided context. 
Using this token, you can easily provide a mock implementation of the logger using any of the standard custom provider techniques, including useClass, useValue, and useFactory.

```ts
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MyService,
      {
        provide: getLoggerToken(MyService.name),
        useValue: mockLogger,
      },
    ],
  }).compile();
```

## Migrating

### v1

- All parameters of v.0 are moved to `pinoHttp` property (except `useExisting`).
- `useExisting` now accept only `true`, because `false` does not make any sense

## FAQ

**Q**: _How does it work?_

**A**: It uses [pino-http](https://github.com/pinojs/pino-http) under hood, so every request has it's own [child-logger](https://github.com/pinojs/pino/blob/master/docs/child-loggers.md), and with help of [async_hooks](https://nodejs.org/api/async_hooks.html) `Logger` and `PinoLogger` can get it while calling own methods. So your logs can be grouped by `req.id`. If you run several instances, unique key is pair: `pid` + `req.id`.

---

**Q**: _Why use [async_hooks](https://nodejs.org/api/async_hooks.html) instead of [REQUEST scope](https://docs.nestjs.com/fundamentals/injection-scopes#per-request-injection)?_

**A**: [REQUEST scope](https://docs.nestjs.com/fundamentals/injection-scopes#per-request-injection) can have [perfomance issues](https://docs.nestjs.com/fundamentals/injection-scopes#performance). TL;DR: it will have to create an instance of the class (that injects `Logger`) on each request, and that will slow down your responce times.

---

**Q**: _I'm using old nodejs version, will it work for me?_

**A**: Please read [this](https://github.com/jeff-lewis/cls-hooked#continuation-local-storage--hooked-).

---

**Q**: _What about pino built-in methods/levels?_

**A**: Pino built-in methods are not compatible with NestJS built-in `LoggerService` methods. So for now there is option which logger to use, here is methods mapping:

| `pino` method | `PinoLogger` method | `Logger` method |
| ------------- | ------------------- | --------------- |
| trace         | trace               | **verbose**     |
| debug         | debug               | debug           |
| info          | info                | **log**         |
| warn          | warn                | warn            |
| error         | error               | error           |
| fatal         | fatal               | -               |

---

**Q**: _Fastify already includes pino, and I want to configure it on `Adapter` level, and use this config for logger_

**A**: You can do it by providing `useExisting: true`. But there is one caveat:

Fastify creates logger with your config per every request. And this logger is used by `Logger`/`PinoLogger` services inside that context underhood.

But Nest Application has another contexts of execution, for example [lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events), where you still may want to use logger. For that `Logger`/`PinoLogger` services use separate `pino` instance with config, that provided via `forRoot`/`forRootAsync` methods.

**So, when you want to configure pino via `FastifyAdapter`, there is no way to get back this config from it and pass to that _out of context_ logger.**

And if you not pass config via `forRoot`/`forRootAsync` _out of context_ logger will be instantiated with default params. So if you want to configure it anyway with the same options, then you have to provide the same config. And then If you are already provide that then you don't have to duplicate your code and provide pino config via fastify.

So these property (`useExisting: true`) is not recommended and useful only for cases when:

- this logger is not using for lifecycle events and application level logging in Nest apps based on fastify
- pino using with default params in Nest apps based on fastify

All the other cases are lead to either code duplication or unexpected behaviour.

<h2 align="center">Do you use this library?<br/>Don't be shy to give it a star! ★</h2>

Also if you are into NestJS ecosystem you may be interested in one of my other libs:

[nestjs-pino](https://github.com/iamolegga/nestjs-pino)

[![GitHub stars](https://img.shields.io/github/stars/iamolegga/nestjs-pino?style=flat-square)](https://github.com/iamolegga/nestjs-pino)
[![npm](https://img.shields.io/npm/dm/nestjs-pino?style=flat-square)](https://www.npmjs.com/package/nestjs-pino)

Platform agnostic logger for NestJS based on [pino](http://getpino.io/) with request context in every log

---

[nestjs-session](https://github.com/iamolegga/nestjs-session)

[![GitHub stars](https://img.shields.io/github/stars/iamolegga/nestjs-session?style=flat-square)](https://github.com/iamolegga/nestjs-session)
[![npm](https://img.shields.io/npm/dm/nestjs-session?style=flat-square)](https://www.npmjs.com/package/nestjs-session)

Idiomatic session module for NestJS. Built on top of [express-session](https://www.npmjs.com/package/express-session)

---

[nestjs-cookie-session](https://github.com/iamolegga/nestjs-cookie-session)

[![GitHub stars](https://img.shields.io/github/stars/iamolegga/nestjs-cookie-session?style=flat-square)](https://github.com/iamolegga/nestjs-cookie-session)
[![npm](https://img.shields.io/npm/dm/nestjs-cookie-session?style=flat-square)](https://www.npmjs.com/package/nestjs-cookie-session)

Idiomatic cookie session module for NestJS. Built on top of [cookie-session](https://www.npmjs.com/package/cookie-session)

---

[nestjs-roles](https://github.com/iamolegga/nestjs-roles)

[![GitHub stars](https://img.shields.io/github/stars/iamolegga/nestjs-roles?style=flat-square)](https://github.com/iamolegga/nestjs-roles)
[![npm](https://img.shields.io/npm/dm/nestjs-roles?style=flat-square)](https://www.npmjs.com/package/nestjs-roles)

Type safe roles guard and decorator made easy

---

[nest-ratelimiter](https://github.com/iamolegga/nestjs-ratelimiter)

[![GitHub stars](https://img.shields.io/github/stars/iamolegga/nestjs-ratelimiter?style=flat-square)](https://github.com/iamolegga/nestjs-ratelimiter)
[![npm](https://img.shields.io/npm/dm/nest-ratelimiter?style=flat-square)](https://www.npmjs.com/package/nest-ratelimiter)

Distributed consistent flexible NestJS rate limiter based on Redis

---

[create-nestjs-middleware-module](https://github.com/iamolegga/create-nestjs-middleware-module)

[![GitHub stars](https://img.shields.io/github/stars/iamolegga/create-nestjs-middleware-module?style=flat-square)](https://github.com/iamolegga/create-nestjs-middleware-module)
[![npm](https://img.shields.io/npm/dm/create-nestjs-middleware-module?style=flat-square)](https://www.npmjs.com/package/create-nestjs-middleware-module)

Create simple idiomatic NestJS module based on Express/Fastify middleware in just a few lines of code with routing out of the box

---

[nestjs-configure-after](https://github.com/iamolegga/nestjs-configure-after)

[![GitHub stars](https://img.shields.io/github/stars/iamolegga/nestjs-configure-after?style=flat-square)](https://github.com/iamolegga/nestjs-configure-after)
[![npm](https://img.shields.io/npm/dm/nestjs-configure-after?style=flat-square)](https://www.npmjs.com/package/nestjs-configure-after)

Declarative configuration of NestJS middleware order
