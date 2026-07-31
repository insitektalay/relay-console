export class Logger {
  constructor(private readonly scope: string) {}

  info(message: string, meta?: unknown) {
    this.log("INFO", message, meta);
  }

  warn(message: string, meta?: unknown) {
    this.log("WARN", message, meta);
  }

  error(message: string, meta?: unknown) {
    this.log("ERROR", message, meta);
  }

  private log(level: string, message: string, meta?: unknown) {
    const prefix = `[${new Date().toISOString()}] [${level}] [${this.scope}]`;
    if (meta === undefined) {
      console.log(`${prefix} ${message}`);
      return;
    }
    console.log(`${prefix} ${message}`, meta);
  }
}
