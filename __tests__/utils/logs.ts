const startMsg = 'Nest application successfully started';
const responseMsg = 'request completed';

export type LogObject = {
  msg: string;
  req?: { id: number };
  res?: Record<string, unknown>;
  context?: string;
  err?: { message: string; stack: string; type: string };
  [key: string]: unknown;
};

export class LogsContainer {
  static from(stringer: { toString(): string }) {
    return new LogsContainer(stringer.toString());
  }

  private readonly logs: LogObject[];

  constructor(logs: string) {
    this.logs = logs
      .split('\n')
      .map((v) => v.trim())
      .filter((v) => !!v)
      .map((v) => JSON.parse(v));
  }

  get some() {
    return this.logs.some.bind(this.logs);
  }

  get find() {
    return this.logs.find.bind(this.logs);
  }

  getStartLog(): LogObject | undefined {
    return this.logs.find((log) => log.msg.startsWith(startMsg));
  }

  getResponseLog(): LogObject | undefined {
    return this.logs.find((log) => log.msg === responseMsg);
  }
}
