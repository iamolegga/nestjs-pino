export type LogObject = {
  msg: string;
  req?: { id: number };
  context?: string;
  trace?: string;
};

export function parseLogs(logs: string): LogObject[] {
  return logs
    .split("\n")
    .map(v => v.trim())
    .filter(v => !!v)
    .map(v => JSON.parse(v));
}
