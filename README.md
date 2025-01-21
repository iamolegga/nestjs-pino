<p align="center">
  <img alt="Bombed Vovchansk, Ukraine" src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Vovchansk_%282024-06-02%29_1513.jpg/640px-Vovchansk_%282024-06-02%29_1513.jpg"/>
  <br />
  <small>"Vovchansk (2024-06-02) 1513" by National Police of Ukraine (Liut Brigade) is licensed under CC BY 4.0.</small>
</p>
<p align="center">
  This is Vovchansk, Ukraine, the city where the father of this library’s author was born. This is how it looks now, after the Russian invasion. If you find this library useful and would like to thank the author, please consider donating any amount via one of the following links:
  <br/>
  ・<a href="https://war.ukraine.ua/donate/">Armed Forces of Ukraine</a>・<a href="https://savelife.in.ua/en/">"The Come Back Alive" foundation</a>・
  <br/>
  Thanks for your support! 🇺🇦
</p>

<h1 align="center">NestJS-Pino</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/nestjs-pino">
    <img alt="npm" src="https://img.shields.io/npm/v/nestjs-pino" />
  </a>
  <a href="https://www.npmjs.com/package/nestjs-pino">
    <img alt="npm" src="https://img.shields.io/npm/dm/nestjs-pino" />
  </a>
  <a href="https://github.com/iamolegga/nestjs-pino/actions">
    <img alt="GitHub branch checks state" src="https://badgen.net/github/checks/iamolegga/nestjs-pino">
  </a>
  <a href="https://codeclimate.com/github/iamolegga/nestjs-pino/test_coverage">
    <img src="https://api.codeclimate.com/v1/badges/2821150bb93506cb66fc/test_coverage" />
  </a>
  <a href="https://snyk.io/test/github/iamolegga/nestjs-pino">
    <img alt="Known Vulnerabilities" src="https://snyk.io/test/github/iamolegga/nestjs-pino/badge.svg" />
  </a>
  <a href="https://libraries.io/npm/nestjs-pino">
    <img alt="Libraries.io" src="https://img.shields.io/librariesio/release/npm/nestjs-pino">
  </a>
  <img alt="Dependabot" src="https://badgen.net/github/dependabot/iamolegga/nestjs-pino">
  <img alt="Supported platforms: Express & Fastify" src="https://img.shields.io/badge/platforms-Express%20%26%20Fastify-green" />
</p>

<p align="center">✨✨✨ Platform agnostic logger for NestJS based on Pino with <b>REQUEST CONTEXT IN EVERY LOG</b> ✨✨✨</p>

---

<p align="center"><b>This is documentation for v2+ which works with NestJS 8+.<br/>Please see documentation for the previous major version which works with NestJS < 8 <a href="https://github.com/iamolegga/nestjs-pino/tree/v1.4.0#readme">here</a>.</b></p>

---

## Install

```sh
npm i nestjs-pino pino-http
```

## Example

Firstly, import module with `LoggerModule.forRoot(...)` or `LoggerModule.forRootAsync(...)` only once in root module (check out module configuration docs [below](#configuration)):

```ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [LoggerModule.forRoot()],
})
class AppModule {}
```

Secondly, set up app logger:

```ts
import { Logger } from 'nestjs-pino';

const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
```

Now you can use one of two loggers:

```ts
// NestJS standard built-in logger.
// Logs will be produced by pino internally
import { Logger } from '@nestjs/common';

export class MyService {
  private readonly logger = new Logger(MyService.name);
  foo() {
    // All logger methods have args format the same as pino, but pino methods
    // `trace` and `info` are mapped to `verbose` and `log` to satisfy
    // `LoggerService` interface of NestJS:
    this.logger.verbose({ foo: 'bar' }, 'baz %s', 'qux');
    this.logger.debug('foo %s %o', 'bar', { baz: 'qux' });
    this.logger.log('foo');
  }
}
```

Usage of the standard logger is recommended and idiomatic for NestJS. But there is one more option to use:

```ts
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

export class MyService {
  constructor(
    private readonly logger: PinoLogger
  ) {
    // Optionally you can set context for logger in constructor or ...
    this.logger.setContext(MyService.name);
  }

  constructor(
    // ... set context via special decorator
    @InjectPinoLogger(MyService.name)
    private readonly logger: PinoLogger
  ) {}

  foo() {
    // PinoLogger has same methods as pino instance
    this.logger.trace({ foo: 'bar' }, 'baz %s', 'qux');
    this.logger.debug('foo %s %o', 'bar', { baz: 'qux' });
    this.logger.info('foo');
  }
}
```

Output:

```json
// Logs by app itself
{"level":30,"time":1629823318326,"pid":14727,"hostname":"my-host","context":"NestFactory","msg":"Starting Nest application..."}
{"level":30,"time":1629823318326,"pid":14727,"hostname":"my-host","context":"InstanceLoader","msg":"LoggerModule dependencies initialized"}
{"level":30,"time":1629823318327,"pid":14727,"hostname":"my-host","context":"InstanceLoader","msg":"AppModule dependencies initialized"}
{"level":30,"time":1629823318327,"pid":14727,"hostname":"my-host","context":"RoutesResolver","msg":"AppController {/}:"}
{"level":30,"time":1629823318327,"pid":14727,"hostname":"my-host","context":"RouterExplorer","msg":"Mapped {/, GET} route"}
{"level":30,"time":1629823318327,"pid":14727,"hostname":"my-host","context":"NestApplication","msg":"Nest application successfully started"}

// Logs by injected Logger and PinoLogger in Services/Controllers. Every log
// has it's request data and unique `req.id` (by default id is unique per
// process, but you can set function to generate it from request context and
// for example pass here incoming `X-Request-ID` header or generate UUID)
{"level":10,"time":1629823792023,"pid":15067,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","query":{},"params":{"0":""},"headers":{"host":"localhost:3000","user-agent":"curl/7.64.1","accept":"*/*"},"remoteAddress":"::1","remotePort":63822},"context":"MyService","foo":"bar","msg":"baz qux"}
{"level":20,"time":1629823792023,"pid":15067,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","query":{},"params":{"0":""},"headers":{"host":"localhost:3000","user-agent":"curl/7.64.1","accept":"*/*"},"remoteAddress":"::1","remotePort":63822},"context":"MyService","msg":"foo bar {\"baz\":\"qux\"}"}
{"level":30,"time":1629823792023,"pid":15067,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","query":{},"params":{"0":""},"headers":{"host":"localhost:3000","user-agent":"curl/7.64.1","accept":"*/*"},"remoteAddress":"::1","remotePort":63822},"context":"MyService","msg":"foo"}

// Automatic logs of every request/response
{"level":30,"time":1629823792029,"pid":15067,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","query":{},"params":{"0":""},"headers":{"host":"localhost:3000","user-agent":"curl/7.64.1","accept":"*/*"},"remoteAddress":"::1","remotePort":63822},"res":{"statusCode":200,"headers":{"x-powered-by":"Express","content-type":"text/html; charset=utf-8","content-length":"12","etag":"W/\"c-Lve95gjOVATpfV8EL5X4nxwjKHE\""}},"responseTime":7,"msg":"request completed"}
```

## Comparison with others

There are other Nestjs loggers. Key purposes of this module are:

- to be idiomatic NestJS logger
- to log in JSON format (thanks to [pino](https://getpino.io/#/) - [super fast logger](https://github.com/pinojs/pino/blob/master/docs/benchmarks.md)) [why](https://www.loggly.com/use-cases/json-logging-best-practices/) [you](https://hackernoon.com/log-everything-as-json-hmq32ax) [should](https://blog.treasuredata.com/blog/2012/04/26/log-everything-as-json/) [use](https://stackify.com/what-is-structured-logging-and-why-developers-need-it/) [JSON](https://softwareengineering.stackexchange.com/a/170528)
- to log every request/response automatically (thanks to [pino-http](https://github.com/pinojs/pino-http#pino-http))
- to bind request data to the logs automatically from any service on any application layer without passing request context (thanks to [AsyncLocalStorage](https://nodejs.org/api/async_context.html#async_context_class_asynclocalstorage))
- to have another alternative logger with same API as `pino` instance (`PinoLogger`) for experienced `pino` users to make more comfortable usage.

| Logger             | Nest App logger | Logger service | Auto-bind request data to logs |
| ------------------ | :-------------: | :------------: | :---------------------------: |
| nest-winston       |        +        |       +        |               -               |
| nestjs-pino-logger |        +        |       +        |               -               |
| **nestjs-pino**    |        +        |       +        |               +               |

## Configuration

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

The following interface is using for the configuration:

```ts
interface Params {
  /**
   * Optional parameters for `pino-http` module
   * @see https://github.com/pinojs/pino-http#api
   */
  pinoHttp?:
    | pinoHttp.Options
    | DestinationStream
    | [pinoHttp.Options, DestinationStream];

  /**
   * Optional parameter for routing. It should implement interface of
   * parameters of NestJS built-in `MiddlewareConfigProxy['forRoutes']`.
   * @see https://docs.nestjs.com/middleware#applying-middleware
   * It can be used for both disabling automatic req/res logs (see above) and
   * removing request context from following logs. It works for all requests by
   * default. If you only need to turn off the automatic request/response
   * logging for some specific (or all) routes but keep request context for app
   * logs use `pinoHttp.autoLogging` field.
   */
  forRoutes?: Parameters<MiddlewareConfigProxy['forRoutes']>;

  /**
   * Optional parameter for routing. It should implement interface of
   * parameters of NestJS built-in `MiddlewareConfigProxy['exclude']`.
   * @see https://docs.nestjs.com/middleware#applying-middleware
   * It can be used for both disabling automatic req/res logs (see above) and
   * removing request context from following logs. It works for all requests by
   * default. If you only need to turn off the automatic request/response
   * logging for some specific (or all) routes but keep request context for app
   * logs use `pinoHttp.autoLogging` field.
   */
  exclude?: Parameters<MiddlewareConfigProxy['exclude']>;

  /**
   * Optional parameter to skip pino configuration in case you are using
   * FastifyAdapter, and already configure logger in adapter's config. The Pros
   * and cons of this approach are described in the FAQ section of the
   * documentation:
   * @see https://github.com/iamolegga/nestjs-pino#faq.
   */
  useExisting?: true;

  /**
   * Optional parameter to change property name `context` in resulted logs,
   * so logs will be like:
   * {"level":30, ... "RENAME_CONTEXT_VALUE_HERE":"AppController" }
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
          // install 'pino-pretty' package in order to use the following option
          transport: process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,


          // and all the other fields of:
          // - https://github.com/pinojs/pino-http#api
          // - https://github.com/pinojs/pino/blob/HEAD/docs/api.md#options-object


        },
        someWritableStream
      ],
      forRoutes: [MyController],
      exclude: [{ method: RequestMethod.ALL, path: 'check' }]
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
  public readonly level = 'debug';
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

### Asynchronous logging

> In essence, asynchronous logging enables even faster performance by `pino`.

Please, read [pino asynchronous mode docs](https://github.com/pinojs/pino/blob/master/docs/asynchronous.md) first. There is a possibility of the most recently buffered log messages being lost in case of a system failure, e.g. a power cut.

If you know what you're doing, you can enable it like so:

```ts
import pino from 'pino';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        stream: pino.destination({
          dest: './my-file', // omit for stdout
          minLength: 4096, // Buffer before writing
          sync: false, // Asynchronous logging
        }),
      },
    }),
  ],
  ...
})
class MyModule {}
```

See [pino.destination](https://github.com/pinojs/pino/blob/master/docs/api.md#pino-destination)

## Testing a class that uses @InjectPinoLogger

This package exposes a `getLoggerToken()` function that returns a prepared injection token based on the provided context.
Using this token, you can provide a mock implementation of the logger using any of the standard custom provider techniques, including `useClass`, `useValue` and `useFactory`.

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

## Logger/PinoLogger class extension

`Logger` and `PinoLogger` classes can be extended.

```ts
// logger.service.ts
import { Logger, PinoLogger, Params, PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';

@Injectable()
class LoggerService extends Logger {
  constructor(
    logger: PinoLogger,
    @Inject(PARAMS_PROVIDER_TOKEN) params: Params
  ) {
    ...
  }
  // extended method
  myMethod(): any {}
}

import { PinoLogger, Params, PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';

@Injectable()
class LoggerService extends PinoLogger {
  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) params: Params
  ) {
    // ...
  }
  // extended method
  myMethod(): any {}
}


// logger.module.ts
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
  imports: [LoggerModule.forRoot()],
})
class LoggerModule {}
```

## Notes on `Logger` injection in constructor

Since logger substitution has appeared in NestJS@8 the main purpose of `Logger` class is to be registered via `app.useLogger(app.get(Logger))`. But that requires some internal breaking change, because with such usage NestJS pass logger's context as the last optional argument in logging function. So in current version `Logger`'s methods accept context as a last argument.

With such change it's not possible to detect if method was called by app internaly and the last argument is context or `Logger` was injected in some service via `constructor(private logger: Logger) {}` and the last argument is interpolation value for example.

## Assign extra fields for future calls

You can enrich logs before calling log methods. It's possible by using `assign` method of `PinoLogger` instance. As `Logger` class is used only for NestJS built-in `Logger` substitution via `app.useLogger(...)` this feature is only limited to `PinoLogger` class. Example:

```ts

@Controller('/')
class TestController {
  constructor(
    private readonly logger: PinoLogger,
    private readonly service: MyService,
  ) {}

  @Get()
  get() {
    // assign extra fields in one place...
    this.logger.assign({ userID: '42' });
    return this.service.test();
  }
}

@Injectable()
class MyService {
  private readonly logger = new Logger(MyService.name);

  test() {
    // ...and it will be logged in another one
    this.logger.log('hello world');
  }
}
```

By default, this does not extend `Request completed` logs. Set the `assignResponse` parameter to `true` to also enrich response logs automatically emitted by `pino-http`.

## Change pino params at runtime

Pino root instance with passed via module registration params creates a separate child logger for every request. This root logger params can be changed at runtime via `PinoLogger.root` property which is the pointer to logger instance. Example:

```ts
@Controller('/')
class TestController {
  @Post('/change-loggin-level')
  setLevel() {
    PinoLogger.root.level = 'info';
    return null;
  }
}
```

## Expose stack trace and error class in `err` property

By default, `pino-http` exposes `err` property with a stack trace and error details, however, this `err` property contains default error details, which do not tell anything about actual error. To expose actual error details you need you to use a NestJS interceptor which captures exceptions and assigns them to the response object `err` property which is later processed by pino-http:   

```typescript
import { LoggerErrorInterceptor } from 'nestjs-pino';

const app = await NestFactory.create(AppModule);
app.useGlobalInterceptors(new LoggerErrorInterceptor());
```

## Migration

### v1

- All parameters of v.0 are moved to `pinoHttp` property (except `useExisting`).
- `useExisting` now accept only `true` because you should already know if you want to use preconfigured fastify adapter's logger (and set `true`) or not (and just not define this field).

### v2

#### Logger substitution

A new more convenient way to inject a custom logger that implements `LoggerService` has appeared in recent versions of NestJS (mind the `bufferLogs` field, it will force NestJS to wait for logger to be ready instead of using built-in logger on start):

```ts
// main.ts
import { Logger } from 'nestjs-pino';
// ...
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
// ...
```

Note that for [standalone applications](https://docs.nestjs.com/standalone-applications), buffering has to be [flushed using app.flushLogs()](https://github.com/nestjs/nest/blob/24e6c821a0859448646fd88831f20e4c5ae50980/packages/core/nest-application-context.ts#L136) manually after custom logger is ready to be used by NestJS (refer to [this issue](https://github.com/iamolegga/nestjs-pino/issues/553) for more details):

```ts
// main.ts
import { Logger } from 'nestjs-pino';

// ... 
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.flushLogs();
// ...
```

In all the other places you can use built-in `Logger`:

```ts
// my-service.ts
import { Logger } from '@nestjs/common';
class MyService {
  private readonly logger = new Logger(MyService.name);
}
```

To quote the official docs:

> If we supply a custom logger via `app.useLogger()`, it will actually be used by Nest internally. That means that our code remains implementation agnostic, while we can easily substitute the default logger for our custom one by calling `app.useLogger()`.
>
> That way if we follow the steps from the previous section and call `app.useLogger(app.get(MyLogger))`, the following calls to `this.logger.log()` from `MyService` would result in calls to method `log` from `MyLogger` instance.

---

**This is recommended to update all your existing `Logger` injections from `nestjs-pino` to `@nestjs/common`. And inject it only in your `main.ts` file as shown above. Support of injection of `Logger` (don't confuse with `PinoLogger`) from `nestjs-pino` directly in class constructors is dropped.**

---

Since logger substitution has appeared the main purpose of `Logger` class is to be registered via `app.useLogger(app.get(Logger))`. But that requires some internal breaking change, because with such usage NestJS pass logger's context as the last optional argument in logging function. So in current version `Logger`'s methods accept context as the last argument.

With such change it's not possible to detect if method was called by app internaly and the last argument is context or `Logger` was injected in some service via `constructor(private logger: Logger) {}` and the last argument is interpolation value for example. That's why logging with such injected class still works, but only for 1 argument.

#### NestJS LoggerService interface breaking change

In NestJS@8 all logging methods of built-in `LoggerService` now accept the same arguments without second `context` argument (which is set via injection, see above), for example: `log(message: any, ...optionalParams: any[]): any;`. That makes usage of built-in logger more convenient and compatible with `pino`'s logging methods. So this is a breaking change in NestJS, and you should be aware of it.

In NestJS <= 7 and `nestjs-pino@1` when you call `this.logger.log('foo', 'bar');` there would be such log: `{..."context":"bar","msg":"foo"}` (second argument goes to `context` field by desing). In NestJS 8 and `nestjs-pino@2` (with proper injection that shown above) same call will result in `{..."context":"MyService","msg":"foo"}`, so `context` is passed via injection, but second argument disappear from log, because now it treats as interpolation value and there should be placeholder for it in `message` argument. So if you want to get both `foo` and `bar` in log the right way to do this is: `this.logger.log('foo %s', 'bar');`. More info can be found in [pino docs](https://getpino.io/#/docs/api?id=logging-method-parameters).

## FAQ

**Q**: _How to disable automatic request/response logs?_

**A**: check out [autoLogging field of pino-http](https://github.com/pinojs/pino-http#pinohttpopts-stream) that are set in `pinoHttp` field of `Params`

---

**Q**: _How to pass `X-Request-ID` header or generate UUID for `req.id` field of log?_

**A**: check out [genReqId field of pino-http](https://github.com/pinojs/pino-http#pinohttpopts-stream) that are set in `pinoHttp` field of `Params`

---

**Q**: _How does it work?_

**A**: It uses [pino-http](https://github.com/pinojs/pino-http) under hood, so every request has it's own [child-logger](https://github.com/pinojs/pino/blob/master/docs/child-loggers.md), and with help of [AsyncLocalStorage](https://nodejs.org/api/async_context.html#async_context_class_asynclocalstorage) `Logger` and `PinoLogger` can get it while calling own methods. So your logs can be grouped by `req.id`.

---

**Q**: _Why use [AsyncLocalStorage](https://nodejs.org/api/async_context.html#async_context_class_asynclocalstorage) instead of [REQUEST scope](https://docs.nestjs.com/fundamentals/injection-scopes#per-request-injection)?_

**A**: [REQUEST scope](https://docs.nestjs.com/fundamentals/injection-scopes#per-request-injection) can have [perfomance issues](https://docs.nestjs.com/fundamentals/injection-scopes#performance). TL;DR: it will have to create an instance of the class (that injects `Logger`) on each request, and that will slow down your response times.

---

**Q**: _I'm using old nodejs version, will it work for me?_

**A**: Please check out [history of this feature](https://nodejs.org/api/async_context.html#async_context_class_asynclocalstorage).

---

**Q**: _What about `pino` built-in methods/levels?_

**A**: Pino built-in methods names are not fully compatible with NestJS built-in `LoggerService` methods names, and there is an option which logger you use. Here is methods mapping:

| `pino` method | `PinoLogger` method | NestJS built-in `Logger` method |
| ------------- | ------------------- | --------------------------------|
| **trace**     | **trace**           | **verbose**                     |
| debug         | debug               | debug                           |
| **info**      | **info**            | **log**                         |
| warn          | warn                | warn                            |
| error         | error               | error                           |
| fatal         | fatal               | fatal (since nestjs@10.2)       |

---

**Q**: _Fastify already includes `pino`, and I want to configure it on `Adapter` level, and use this config for logger_

**A**: You can do it by providing `useExisting: true`. But there is one caveat:

Fastify creates logger with your config per every request. And this logger is used by `Logger`/`PinoLogger` services inside that context underhood.

But Nest Application has another contexts of execution, for example [lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events), where you still may want to use logger. For that `Logger`/`PinoLogger` services use separate `pino` instance with config, that provided via `forRoot`/`forRootAsync` methods.

So, when you want to configure `pino` via `FastifyAdapter` there is no way to get back this config from fastify and pass it to that _out of context_ logger.

And if you will not pass config via `forRoot`/`forRootAsync` _out of context_ logger will be instantiated with default params. So if you want to configure it with the same options for consistency you have to provide the same config to `LoggerModule` configuration too. But if you already provide it to `LoggerModule` configuration you can drop `useExisting` field from config and drop logger configuration on `FastifyAdapter`, and it will work without code duplication.

So this property (`useExisting: true`) is not recommended, and can be useful only for cases when:

- this logger is not using for lifecycle events and application level logging in NestJS apps based on fastify
- `pino` is using with default params in NestJS apps based on fastify

All the other cases are lead to either code duplication or unexpected behavior.

---

<h2 align="center">Do you use this library?<br/>Don't be shy to give it a star! ★</h2>

<h3 align="center">Also if you are into NestJS you might be interested in one of my <a href="https://github.com/iamolegga#nestjs">other NestJS libs</a>.</h3>
