<p align="center">
  <img alt="NestJS-Pino logo" src="./logo.jpg" width="300" height="300" />
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
  <img alt="Supported platforms: Express & Fastify" src="https://img.shields.io/badge/platforms-Express%20%26%20Fastify-green" />
</p>

<p align="center">✨✨✨ Platform agnostic logger for NestJS based on Pino with <b>REQUEST CONTEXT IN EVERY LOG</b> ✨✨✨</p>

## Example

In controller:

```ts
import { Logger } from 'nestjs-pino';

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
```

In service:

```ts
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

Output (every log has request context):

```json
{"level":30,"time":1568720266616,"pid":25566,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","headers":{...},"remoteAddress":"::1","remotePort":53753},"msg":"calling AppController.getHello","v":1}
{"level":20,"time":1568720266616,"pid":25566,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","headers":{...},"remoteAddress":"::1","remotePort":53753},"msg":"calling MyService.getWorld","v":1}
{"level":30,"time":1568720266623,"pid":25566,"hostname":"my-host","req":{"id":1,"method":"GET","url":"/","headers":{...},"remoteAddress":"::1","remotePort":53753},"res":{"statusCode":200,"headers":{...}},"responseTime":9,"msg":"request completed","v":1}
```

## Install

```sh
npm i nestjs-pino
```

## Register module

### Default params

Just import `LoggerModule` to your module:

```ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [LoggerModule.forRoot()],
  ...
})
class MyModule {}
```

### Configure

Also, you can configure it. `forRoot` function has the same API as [express-pino-logger](https://github.com/pinojs/express-pino-logger#api) has (it's the same as [pino itself](https://github.com/pinojs/pino/blob/master/docs/api.md#options) and can take existing logger via `{ logger: pino(...) }`):

```ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot(
      {
        name: 'add some name to every JSON line',
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        prettyPrint: process.env.NODE_ENV !== 'production',
        useLevelLabels: true,
        // and all the others...
      },
      someWritableStream
    )
  ],
  ...
})
class MyModule {}
```

### Extreme mode

If you want to enable `extreme` mode you should read [pino extreme mode docs](https://github.com/pinojs/pino/blob/master/docs/extreme.md#extreme-mode) first.

If you are ok with that, so you can configure module like this:

```ts
import * as pino from 'pino';
import { LoggerModule } from 'nestjs-pino';

const dest = pino.extreme();
const logger = pino(dest);

@Module({
  imports: [LoggerModule.forRoot({ logger })],
  ...
})
class MyModule {}
```

Also you can read more about [Log loss prevention](https://github.com/pinojs/pino/blob/master/docs/extreme.md#log-loss-prevention).

## Usage as Logger service

`Logger` implements standard NestJS `LoggerService` interface. So if you are familiar with [built in NestJS logger](https://docs.nestjs.com/techniques/logger) you are good to go.

```ts
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

## Usage as NestJS app logger

```ts
import { Logger } from 'nestjs-pino';

const app = await NestFactory.create(MyModule, { logger: new Logger() });
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
