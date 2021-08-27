import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "../src";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(3000);
}

bootstrap();
