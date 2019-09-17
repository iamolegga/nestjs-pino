import { Injectable } from "@nestjs/common";
import pino from "pino";

@Injectable()
export class Config {
  public readonly logLevel = process.env.LOG_LEVEL as pino.Level;
}
