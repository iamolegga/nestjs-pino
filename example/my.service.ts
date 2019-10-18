import { Injectable } from "@nestjs/common";
import { PinoLogger, InjectPinoLogger } from "../src";

@Injectable()
export class MyService {
  constructor(
    @InjectPinoLogger(MyService.name) private readonly logger: PinoLogger
  ) {}

  getWorld(...params: any[]) {
    this.logger.debug("getWorld(%o)", MyService.name, params);
    return "World!";
  }
}
