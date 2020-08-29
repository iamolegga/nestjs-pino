import { NestFactory } from "@nestjs/core";
import { Module, Controller, Get, Injectable, Logger as NestjsLogger } from "@nestjs/common";
import MemoryStream = require("memorystream");
import * as request from "supertest";
import { Logger, LoggerModule } from "../src";
import { platforms } from "./utils/platforms";
import { fastifyExtraWait } from "./utils/fastifyExtraWait";
import { parseLogs } from "./utils/logs";
import { __resetOutOfContextForTests } from "../src/PinoLogger";
import * as pino from 'pino';

const loggerMethods: [keyof Logger, pino.Level][] = [
  ["verbose", "trace"],
  ["debug", "debug"],
  ["log", "info"],
  ["warn", "warn"],
  ["error", "error"]
];

describe("pino logging", () => {
  beforeEach(() => __resetOutOfContextForTests());

  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      for (const useContext of [true, false]) {
        describe(`usage via @nestjs/common/Logger ${useContext ? 'with' : 'without'} context`, () => {
          for (const [loggerMethodName, pinoLevel] of loggerMethods) {
            describe(loggerMethodName, () => {
              it("logs strings as `msg` field", async () => {
                const stream = new MemoryStream();
                const random = Math.random().toString();
                let logs = "";
                stream.on("data", (chunk: string) => {
                  logs += chunk.toString();
                });

                @Controller("/")
                class TestController {
                  logger = new NestjsLogger(useContext ? TestController.name : undefined);

                  @Get("/")
                  get() {
                    if (loggerMethodName === 'error') {
                      this.logger[loggerMethodName](random, 'trace');
                    } else {
                      this.logger[loggerMethodName](random);
                    }
                    return {};
                  }
                }

                @Module({
                  imports: [LoggerModule.forRoot({pinoHttp: [{level: pinoLevel}, stream]})],
                  controllers: [TestController]
                })
                class TestModule {
                }

                const app = await NestFactory.create(
                  TestModule,
                  new PlatformAdapter(),
                  {logger: false}
                );
                app.useLogger(app.get(Logger));
                const server = app.getHttpServer();

                await app.init();
                await fastifyExtraWait(PlatformAdapter, app);

                await request(server).get("/");
                await app.close();

                const parsedLogs = parseLogs(logs);
                const logObject = parsedLogs.find(v => v.msg === random);
                expect(logObject).toBeTruthy();
                expect(logObject && logObject.context).toBe(useContext ? TestController.name : undefined);
                if (loggerMethodName === 'error') {
                  expect(logObject && logObject.trace).toBe('trace');
                }
              });

              it("logs object messages to root object", async () => {
                const stream = new MemoryStream();
                const random = Math.random().toString();
                let logs = "";
                stream.on("data", (chunk: string) => {
                  logs += chunk.toString();
                });

                @Controller("/")
                class TestController {
                  logger = new NestjsLogger(useContext ? TestController.name : undefined);

                  @Get("/")
                  get() {
                    const msgObject = {
                      msg: random,
                      additional: 'value'
                    };
                    if (loggerMethodName === 'error') {
                      this.logger[loggerMethodName](msgObject, 'trace');
                    } else {
                      this.logger[loggerMethodName](msgObject);
                    }
                    return {};
                  }
                }

                @Module({
                  imports: [LoggerModule.forRoot({pinoHttp: [{level: pinoLevel}, stream]})],
                  controllers: [TestController]
                })
                class TestModule {
                }

                const app = await NestFactory.create(
                  TestModule,
                  new PlatformAdapter(),
                  {logger: false}
                );
                app.useLogger(app.get(Logger));
                const server = app.getHttpServer();

                await app.init();
                await fastifyExtraWait(PlatformAdapter, app);

                await request(server).get("/");
                await app.close();

                const parsedLogs = parseLogs(logs);
                const logObject = parsedLogs.find(v => v.msg === random);
                expect(logObject).toBeTruthy();
                expect(logObject && logObject.context).toBe(useContext ? TestController.name : undefined);
                expect(logObject && logObject.additional).toBe('value');
                if (loggerMethodName === 'error') {
                  expect(logObject && logObject.trace).toBe('trace');
                }
              });

              it("overrides context with value from message", async () => {
                const stream = new MemoryStream();
                const random = Math.random().toString();
                let logs = "";
                stream.on("data", (chunk: string) => {
                  logs += chunk.toString();
                });

                @Controller("/")
                class TestController {
                  logger = new NestjsLogger(useContext ? TestController.name : undefined);

                  @Get("/")
                  get() {
                    const msgObject = {
                      msg: random,
                      context: 'MyContext'
                    };
                    if (loggerMethodName === 'error') {
                      this.logger[loggerMethodName](msgObject, 'trace');
                    } else {
                      this.logger[loggerMethodName](msgObject);
                    }
                    return {};
                  }
                }

                @Module({
                  imports: [LoggerModule.forRoot({pinoHttp: [{level: pinoLevel}, stream]})],
                  controllers: [TestController]
                })
                class TestModule {
                }

                const app = await NestFactory.create(
                  TestModule,
                  new PlatformAdapter(),
                  {logger: false}
                );
                app.useLogger(app.get(Logger));
                const server = app.getHttpServer();

                await app.init();
                await fastifyExtraWait(PlatformAdapter, app);

                await request(server).get("/");
                await app.close();

                const parsedLogs = parseLogs(logs);
                const logObject = parsedLogs.find(v => v.msg === random);
                expect(logObject).toBeTruthy();
                expect(logObject && logObject.context).toBe('MyContext');
                if (loggerMethodName === 'error') {
                  expect(logObject && logObject.trace).toBe('trace');
                }
              });
            });
          }
        });
      }
    });
  }
});
