import { Injectable } from "@nestjs/common";
import { Logger } from "../src";

@Injectable()
export class MyService {
  constructor(private readonly logger: Logger) {}

  getWorld() {
    this.logger.debug("calling MyService.getWorld");
    return "World!";
  }
}
