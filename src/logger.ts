import { window } from "vscode";

function callerLocation(skip = 2): string {
  const stack = new Error().stack;
  if (!stack) return '';
  const lines = stack.split('\n');
  const frame = lines[skip + 1];
  if (!frame) return '';
  const s = frame.trim();

  let content: string;
  const parenOpen = s.lastIndexOf('(');
  if (parenOpen >= 0) {
    content = s.slice(parenOpen + 1, s.endsWith(')') ? -1 : undefined);
  } else {
    content = s.replace(/^at\s+/, '');
  }

  const sep = content.lastIndexOf(':');
  if (sep < 0) return '';
  const sep2 = content.lastIndexOf(':', sep - 1);
  if (sep2 < 0) return '';

  const filePart = content.slice(0, sep2);
  const line = content.slice(sep2 + 1, sep);
  const segments = filePart.split(/[/\\]/);
  const srcIdx = segments.lastIndexOf('src');
  const short = srcIdx >= 0 ? segments.slice(srcIdx).join('/') : segments.slice(-2).join('/');

  return `${short}:${line}`;
}

export interface ILogger {
  trace(msg: string): void;
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

const noop = () => {};

const _logger: ILogger = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};

let _channel: ILogger | null = null;

export function getLogger(): ILogger {
  return _logger;
}

export function initLogger(name: string): void {
  _channel = window.createOutputChannel(name, { log: true }) as unknown as ILogger;

  _logger.trace = (msg: string) => {
    const loc = callerLocation();
    _channel!.trace(loc ? `[${loc}] ${msg}` : msg);
  };
  _logger.debug = (msg: string) => {
    const loc = callerLocation();
    _channel!.debug(loc ? `[${loc}] ${msg}` : msg);
  };
  _logger.info = (msg: string) => {
    const loc = callerLocation();
    _channel!.info(loc ? `[${loc}] ${msg}` : msg);
  };
  _logger.warn = (msg: string) => {
    const loc = callerLocation();
    _channel!.warn(loc ? `[${loc}] ${msg}` : msg);
  };
  _logger.error = (msg: string) => {
    const loc = callerLocation();
    _channel!.error(loc ? `[${loc}] ${msg}` : msg);
  };
}
