import { NestFactory } from "@nestjs/core";
import { Module, Controller, Get, Injectable } from "@nestjs/common";
import MemoryStream from "memorystream";
import request from "supertest";
import { Logger, LoggerModule } from "../src";
import { platforms } from "./utils/platforms";
import { fastifyExtraWait } from "./utils/fastifyExtraWait";
import { parseLogs } from "./utils/logs";

describe("module initialization", () => {
  for (const PlatformAdapter of platforms) {
    describe(PlatformAdapter.name, () => {
      describe("forRoot", () => {
        it("should compile without params", async () => {
          @Controller("/")
          class TestController {
            constructor(private readonly logger: Logger) {}
            @Get("/")
            get() {
              this.logger.log("");
              return {};
            }
          }

          @Module({
            imports: [LoggerModule.forRoot()],
            controllers: [TestController]
          })
          class TestModule {}

          const app = await NestFactory.create(
            TestModule,
            new PlatformAdapter(),
            { logger: false }
          );
          await app.init();
          await fastifyExtraWait(PlatformAdapter, app);
        });

        it("should work properly with single param", async () => {
          const stream = new MemoryStream();
          const random = Math.random().toString();
          let logs = "";
          stream.on("data", (chunk: string) => {
            logs += chunk.toString();
          });

          @Controller("/")
          class TestController {
            constructor(private readonly logger: Logger) {}
            @Get("/")
            get() {
              this.logger.log(random);
              return {};
            }
          }

          @Module({
            imports: [LoggerModule.forRoot(stream)],
            controllers: [TestController]
          })
          class TestModule {}

          const app = await NestFactory.create(
            TestModule,
            new PlatformAdapter(),
            { logger: false }
          );
          const server = app.getHttpServer();

          await app.init();
          await fastifyExtraWait(PlatformAdapter, app);

          await request(server).get("/");
          await app.close();

          const parsedLogs = parseLogs(logs);
          const logObject = parsedLogs.find(v => v.msg === random);
          expect(logObject).toBeTruthy();
        });

        it("should work properly with two params", async () => {
          const stream = new MemoryStream();
          const random = Math.random().toString();
          let logs = "";
          stream.on("data", (chunk: string) => {
            logs += chunk.toString();
          });

          @Controller("/")
          class TestController {
            constructor(private readonly logger: Logger) {}
            @Get("/")
            get() {
              this.logger.debug(random);
              return {};
            }
          }

          @Module({
            imports: [LoggerModule.forRoot({ level: "debug" }, stream)],
            controllers: [TestController]
          })
          class TestModule {}

          const app = await NestFactory.create(
            TestModule,
            new PlatformAdapter(),
            { logger: false }
          );
          const server = app.getHttpServer();

          await app.init();
          await fastifyExtraWait(PlatformAdapter, app);

          await request(server).get("/");
          await app.close();

          const parsedLogs = parseLogs(logs);
          const logObject = parsedLogs.find(v => v.msg === random);
          expect(logObject).toBeTruthy();
        });
      });

      describe("forRootAsync", () => {
        it("should compile when useFactory returns null", async () => {
          @Controller("/")
          class TestController {
            constructor(private readonly logger: Logger) {}
            @Get("/")
            get() {
              this.logger.log("");
              return {};
            }
          }

          @Module({
            imports: [LoggerModule.forRootAsync({ useFactory: () => null })],
            controllers: [TestController]
          })
          class TestModule {}

          const app = await NestFactory.create(
            TestModule,
            new PlatformAdapter(),
            { logger: false }
          );
          await app.init();
          await fastifyExtraWait(PlatformAdapter, app);
        });

        it("should work properly when useFactory returns single params", async () => {
          const stream = new MemoryStream();
          const random = Math.random().toString();
          let logs = "";

          stream.on("data", (chunk: string) => {
            logs += chunk.toString();
          });

          @Controller("/")
          class TestController {
            constructor(private readonly logger: Logger) {}
            @Get("/")
            get() {
              this.logger.log(random);
              return {};
            }
          }

          @Injectable()
          class ConfigService {
            public readonly stream = stream;
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
                useFactory: (config: ConfigService) => {
                  return config.stream;
                }
              })
            ],
            controllers: [TestController]
          })
          class TestModule {}

          const app = await NestFactory.create(
            TestModule,
            new PlatformAdapter(),
            { logger: false }
          );
          const server = app.getHttpServer();

          await app.init();
          await fastifyExtraWait(PlatformAdapter, app);

          await request(server).get("/");
          await app.close();

          const parsedLogs = parseLogs(logs);
          const logObject = parsedLogs.find(v => v.msg === random);
          expect(logObject).toBeTruthy();
        });

        it("should work properly when useFactory returns array of two params", async () => {
          const stream = new MemoryStream();
          const random = Math.random().toString();
          let logs = "";

          stream.on("data", (chunk: string) => {
            logs += chunk.toString();
          });

          @Controller("/")
          class TestController {
            constructor(private readonly logger: Logger) {}
            @Get("/")
            get() {
              this.logger.debug(random);
              return {};
            }
          }

          @Injectable()
          class ConfigService {
            public readonly level = "debug";
            public readonly stream = stream;
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
                useFactory: (config: ConfigService) => {
                  return [{ level: config.level }, config.stream];
                }
              })
            ],
            controllers: [TestController]
          })
          class TestModule {}

          const app = await NestFactory.create(
            TestModule,
            new PlatformAdapter(),
            { logger: false }
          );
          const server = app.getHttpServer();

          await app.init();
          await fastifyExtraWait(PlatformAdapter, app);

          await request(server).get("/");
          await app.close();

          const parsedLogs = parseLogs(logs);
          const logObject = parsedLogs.find(v => v.msg === random);
          expect(logObject).toBeTruthy();
        });

        it("should work properly when pass deps via providers", async () => {
          const stream = new MemoryStream();
          const random = Math.random().toString();
          let logs = "";

          stream.on("data", (chunk: string) => {
            logs += chunk.toString();
          });

          @Controller("/")
          class TestController {
            constructor(private readonly logger: Logger) {}
            @Get("/")
            get() {
              this.logger.log(random);
              return {};
            }
          }

          @Injectable()
          class ConfigService {
            public readonly stream = stream;
          }

          @Module({
            imports: [
              LoggerModule.forRootAsync({
                providers: [ConfigService],
                inject: [ConfigService],
                useFactory: (config: ConfigService) => {
                  return config.stream;
                }
              })
            ],
            controllers: [TestController]
          })
          class TestModule {}

          const app = await NestFactory.create(
            TestModule,
            new PlatformAdapter(),
            { logger: false }
          );
          const server = app.getHttpServer();

          await app.init();
          await fastifyExtraWait(PlatformAdapter, app);

          await request(server).get("/");
          await app.close();

          const parsedLogs = parseLogs(logs);
          const logObject = parsedLogs.find(v => v.msg === random);
          expect(logObject).toBeTruthy();
        });
      });
    });
  }
});
