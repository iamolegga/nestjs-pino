import { Injectable } from "@nestjs/common";
import { Logger } from "../src";

@Injectable()
export class MyService {
  constructor(private readonly logger: Logger) {}

  getWorld(...params: any[]) {
    this.logger.debug("getWorld(%o)", MyService.name, params);
    return "World!";
  }
}
