# nestjs-pino

[![npm](https://img.shields.io/npm/v/nestjs-pino)](https://www.npmjs.com/package/nestjs-pino)
[![Travis (.org)](https://img.shields.io/travis/iamolegga/nestjs-pino)](https://travis-ci.org/iamolegga/nestjs-pino)
[![Coverage Status](https://coveralls.io/repos/github/iamolegga/nestjs-pino/badge.svg?branch=master)](https://coveralls.io/github/iamolegga/nestjs-pino?branch=master)
![Snyk Vulnerabilities for npm package](https://img.shields.io/snyk/vulnerabilities/npm/nestjs-pino)

Logging in NestJS with automatic tracing on every layer

## Example

```ts
// app.controller.ts
@Controller()
export class AppController {
  constructor(
    private readonly myService: MyService,
    private readonly logger: Logger
  ) {}

  @Get()
  getHello(): string {
    this.logger.log("calling AppController.getHello");
    return `Hello ${this.myService.getWorld()}`;
  }
}

// my.service.ts
import { Logger } from 'nestjs-pino';

@Injectable()
export class MyService {
  constructor(private readonly logger: Logger) {}

  getWorld() {
    this.logger.debug("calling MyService.getWorld");
    return "World!";
  }
}
```

output:

```json
{"level":30,"time":1568720266616,"pid":25566,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","headers":{...},"remoteAddress":"::1","remotePort":53753},"msg":"calling AppController.getHello","v":1}

{"level":20,"time":1568720266616,"pid":25566,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","headers":{...},"remoteAddress":"::1","remotePort":53753},"msg":"calling MyService.getWorld","v":1}

{"level":30,"time":1568720266623,"pid":25566,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","headers":{...},"remoteAddress":"::1","remotePort":53753},"res":{"statusCode":200,"headers":{...}},"responseTime":9,"msg":"request completed","v":1}
```

## Install

```sh
npm i nestjs-pino
```

## Using

### Setup middlewares

First of all you shoud setup middlewares, that allows to do:

- automatic logging of every request/response
- automatic binding each log to it's request context when using `Logger` service

```ts
import { createLoggerMiddlewares } from 'nestjs-pino';

const app = await NestFactory.create(MyModule);

// basic example
app.use(...createLoggerMiddlewares());

// if you want to configure logger somehow depending on your ConfigService
// you can do something like that:
const config = app.get(ConfigService);
app.use(...createLoggerMiddlewares({ level: config.logLevel }));
```

`createLoggerMiddlewares` API is the same as [express-pino-logger](https://github.com/pinojs/express-pino-logger#api)

### Providing Logger service

Just add `Logger` as provider to your module:

```ts
import { Logger } from 'nestjs-pino';

@Module({
  providers: [Logger]
})
class MyModule {}
```

### Usage as Logger service

`Logger` implements standard NestJS `LoggerService` interface. So if you are familiar with [built in NestJS logger](https://docs.nestjs.com/techniques/logger) you are good to go.

### Usage as NestJS app logger

```ts
const app = await NestFactory.create(MyModule, { logger: false });
app.useLogger(app.get(Logger));
```

## FAQ

__Q__: _How does it work?_

__A__: It use [express-pino-logger](https://github.com/pinojs/express-pino-logger) under hood, so every request has it's own [child-logger](https://github.com/pinojs/pino/blob/master/docs/child-loggers.md), and with help of [async_hooks](https://nodejs.org/api/async_hooks.html) `Logger` can get it while calling own methods. So your logs can be groupped by `req.id`.

__Q__: _Why use [async_hooks](https://nodejs.org/api/async_hooks.html) instead of [REQUEST scope](https://docs.nestjs.com/fundamentals/injection-scopes#per-request-injection)?_

__A__: [REQUEST scope](https://docs.nestjs.com/fundamentals/injection-scopes#per-request-injection) can have [perfomance issues](https://docs.nestjs.com/fundamentals/injection-scopes#performance) depending on your app. TL;DR: using it will cause to instantiating every class, that injects `Logger`, as a result it will slow down your app.

__Q__: _I'm using old nodejs version, will it work for me?_

__A__: Please read [this](https://github.com/jeff-lewis/cls-hooked#continuation-local-storage--hooked-).

__Q__: _What about pino built in methods/levels?_

__A__: Pino built in methods are not compatible to NestJS built in `LoggerService` methods, so decision is to map pino methods to `LoggerService` methods to save `Logger` API:
  - `trace`=`verbose`
  - `debug`=`debug`
  - `info`=`log`
  - `warn`=`warn`
  - `error`=`error`
