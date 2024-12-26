export class Logger {
  private isDebug: boolean;
  private prefix: string;

  constructor(isDebug: boolean = false, prefix: string = '[cluesive]') {
    this.isDebug = isDebug;
    this.prefix = prefix;
  }

  debug(...args: unknown[]): void {
    if (this.isDebug) {
      console.debug(this.prefix, '🔍', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.isDebug) {
      console.info(this.prefix, 'ℹ️', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.isDebug) {
      console.warn(this.prefix, '⚠️', ...args);
    }
  }

  error(...args: unknown[]): void {
    // Always log errors, even in non-debug mode
    console.error(this.prefix, '❌', ...args);
  }

  group(label: string): void {
    if (this.isDebug) {
      console.group(`${this.prefix} 📦 ${label}`);
    }
  }

  groupEnd(): void {
    if (this.isDebug) {
      console.groupEnd();
    }
  }
}