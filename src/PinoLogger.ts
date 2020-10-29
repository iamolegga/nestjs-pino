import { Injectable, Inject, Scope } from "@nestjs/common";
import * as pino from "pino";
import { getValue } from "express-ctx";
import { PARAMS_PROVIDER_TOKEN, LOGGER_KEY } from "./constants";
import { Params, isPassedLogger } from "./params";

interface PinoMethods
  extends Pick<
    pino.BaseLogger,
    "trace" | "debug" | "info" | "warn" | "error" | "fatal"
  > {}

type LoggerFn =
  | ((msg: string, ...args: any[]) => void)
  | ((obj: object, msg?: string, ...args: any[]) => void);

let outOfContext: pino.Logger;

export function __resetOutOfContextForTests() {
  // only for tests
  // @ts-ignore
  outOfContext = undefined;
}

@Injectable({ scope: Scope.TRANSIENT })
export class PinoLogger implements PinoMethods {
  private context = "";
  private readonly contextName: string;

  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) { pinoHttp, renameContext }: Params
  ) {
    if (!outOfContext) {
      if (Array.isArray(pinoHttp)) {
        outOfContext = pino(...pinoHttp);
      } else if (isPassedLogger(pinoHttp)) {
        outOfContext = pinoHttp.logger;
      } else {
        outOfContext = pino(pinoHttp);
      }
    }

    this.contextName = renameContext || "context";
  }

  trace(msg: string, ...args: any[]): void;
  trace(obj: object, msg?: string, ...args: any[]): void;
  trace(...args: Parameters<LoggerFn>) {
    this.call("trace", ...args);
  }

  debug(msg: string, ...args: any[]): void;
  debug(obj: object, msg?: string, ...args: any[]): void;
  debug(...args: Parameters<LoggerFn>) {
    this.call("debug", ...args);
  }

  info(msg: string, ...args: any[]): void;
  info(obj: object, msg?: string, ...args: any[]): void;
  info(...args: Parameters<LoggerFn>) {
    this.call("info", ...args);
  }

  warn(msg: string, ...args: any[]): void;
  warn(obj: object, msg?: string, ...args: any[]): void;
  warn(...args: Parameters<LoggerFn>) {
    this.call("warn", ...args);
  }

  error(msg: string, ...args: any[]): void;
  error(obj: object, msg?: string, ...args: any[]): void;
  error(...args: Parameters<LoggerFn>) {
    this.call("error", ...args);
  }

  fatal(msg: string, ...args: any[]): void;
  fatal(obj: object, msg?: string, ...args: any[]): void;
  fatal(...args: Parameters<LoggerFn>) {
    this.call("fatal", ...args);
  }

  setContext(value: string) {
    this.context = value;
  }

  private call(method: pino.Level, ...args: Parameters<LoggerFn>) {
    const context = this.context;
    if (context) {
      const firstArg = args[0];
      if (typeof firstArg === "object") {
        if (firstArg instanceof Error) {
          args = [
            Object.assign({ [this.contextName]: context }, { err: firstArg }),
            ...args.slice(1)
          ];
        } else {
          args = [
            Object.assign({ [this.contextName]: context }, firstArg),
            ...args.slice(1)
          ];
        }
      } else {
        args = [{ [this.contextName]: context }, ...args];
      }
    }

    (this.logger[method] as any)(...args);
  }

  private get logger() {
    return getValue<pino.Logger>(LOGGER_KEY) || outOfContext;
  }
}
