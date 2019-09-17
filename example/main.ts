import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { createLoggerMiddlewares, Logger } from "../src";
import { Config } from "./config.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });

  // pass params to logger from another service
  const config = app.get<Config>(Config);
  app.use(...createLoggerMiddlewares({ level: config.logLevel }));

  // logging app information with logger
  const logger = app.get<Logger>(Logger);
  app.useLogger(logger);

  await app.listen(3000);
}
bootstrap();
