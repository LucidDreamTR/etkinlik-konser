import { redact } from "./redact";

type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown> | undefined;

function emit(level: LogLevel, message: string, payload?: LogPayload) {
  const record = {
    level,
    message,
    time: new Date().toISOString(),
    ...(payload ? { ...payload } : {}),
  };
  const safe = redact(record);
  const line = JSON.stringify(safe);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

export const logger = {
  info(message: string, payload?: LogPayload) {
    emit("info", message, payload);
  },
  warn(message: string, payload?: LogPayload) {
    emit("warn", message, payload);
  },
  error(message: string, payload?: LogPayload) {
    emit("error", message, payload);
  },
};
