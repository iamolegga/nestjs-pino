import { NestFactory } from "@nestjs/core";
import {
  Module,
  INestApplication,
  Controller,
  Get,
  Injectable
} from "@nestjs/common";
import MemoryStream from "memorystream";
import request from "supertest";
import pino from "pino";
import { Logger, LoggerModule } from "./";

type LogObject = {
  msg: string;
  req?: { id: number };
};

describe("methods", () => {
  const methods: [keyof Logger, pino.Level][] = [
    ["verbose", "trace"],
    ["debug", "debug"],
    ["log", "info"],
    ["warn", "warn"],
    ["error", "error"]
  ];

  for (const [loggerMethodName, pinoLevel] of methods) {
    it(loggerMethodName, async () => {
      const stream = new MemoryStream();
      const random = Math.random().toString();
      let logs = "";

      stream.on("data", (chunk: string) => {
        logs += chunk.toString();
      });

      @Injectable()
      class TestService {
        constructor(private readonly logger: Logger) {}
        someMethod() {
          this.logger[loggerMethodName](random);
        }
      }

      @Controller("/")
      class TestController {
        constructor(private readonly service: TestService) {}
        @Get("/")
        get() {
          this.service.someMethod();
          return {};
        }
      }

      @Module({
        imports: [LoggerModule.forRoot({ level: pinoLevel }, stream)],
        controllers: [TestController],
        providers: [TestService, Logger]
      })
      class TestModule {}

      const app = await NestFactory.create(TestModule, { logger: false });
      const server = app.getHttpServer();

      const logger = app.get(Logger);

      await app.init();
      await request(server).get("/");

      logger[loggerMethodName](random);

      await app.close();

      const parsedLogs = parseLogs(logs);

      const serviceLogObject = parsedLogs.find(v => v.msg === random && v.req);
      const outOfContextLogObject = parsedLogs.find(
        v => v.msg === random && !v.req
      );
      expect(serviceLogObject).toBeTruthy();
      expect(outOfContextLogObject).toBeTruthy();
    });
  }
});

describe("request context", () => {
  let stream: MemoryStream;
  let app: INestApplication;
  let random: string;
  let parsedLogs: LogObject[];

  beforeAll(async () => {
    stream = new MemoryStream();
    random = Math.random().toString();
    let logs = "";

    stream.on("data", (chunk: string) => {
      logs += chunk.toString();
    });

    @Injectable()
    class TestService {
      constructor(private readonly logger: Logger) {}
      someMethod() {
        this.logger.log(random);
      }
    }

    @Controller("/")
    class TestController {
      constructor(private readonly service: TestService) {}
      @Get("/")
      get() {
        this.service.someMethod();
        return {};
      }
    }

    @Module({
      imports: [LoggerModule.forRoot(stream)],
      controllers: [TestController],
      providers: [TestService, Logger]
    })
    class TestModule {}

    app = await NestFactory.create(TestModule, { logger: new Logger() });
    const server = app.getHttpServer();

    await app.init();
    await request(server).get("/");
    await app.close();
    parsedLogs = parseLogs(logs);
  });

  it("should log on response", () => {
    const responseLogObject = parsedLogs.find(
      log => log.msg === "request completed"
    );
    expect(responseLogObject).toBeTruthy();
  });

  it("should log with context", () => {
    const serviceLogObject = parsedLogs.find(log => log.msg === random);
    expect(serviceLogObject).toHaveProperty("req");
  });

  it("should work as nest application logger", () => {
    const nestAppLog = parsedLogs.find(log =>
      log.msg.includes("Nest application successfully started")
    );
    expect(nestAppLog).toBeTruthy();
  });
});

describe("passed logger", () => {
  it("should be used", async () => {
    const stream = new MemoryStream();
    const random = Math.random().toString();
    let logs = "";

    stream.on("data", (chunk: string) => {
      logs += chunk.toString();
    });

    @Injectable()
    class TestService {
      constructor(private readonly logger: Logger) {}
      someMethod() {
        this.logger.log(random);
      }
    }

    @Controller("/")
    class TestController {
      constructor(private readonly service: TestService) {}
      @Get("/")
      get() {
        this.service.someMethod();
        return {};
      }
    }

    @Module({
      imports: [LoggerModule.forRoot({ logger: pino(stream) })],
      controllers: [TestController],
      providers: [TestService, Logger]
    })
    class TestModule {}

    const app = await NestFactory.create(TestModule, { logger: new Logger() });
    const server = app.getHttpServer();

    await app.init();
    await request(server).get("/");
    await app.close();

    const parsedLogs = parseLogs(logs);
    const serviceLogObject = parsedLogs.find(v => v.msg === random);
    expect(serviceLogObject).toBeTruthy();
  });
});

function parseLogs(logs: string): LogObject[] {
  return logs
    .split("\n")
    .map(v => v.trim())
    .filter(v => !!v)
    .map(v => JSON.parse(v));
}
