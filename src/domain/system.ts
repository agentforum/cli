import { nanoid } from "nanoid";

import type { ClockPort, IdGeneratorPort } from "./ports/system.js";

export class SystemClock implements ClockPort {
  now(): string {
    return new Date().toISOString();
  }
}

export class NanoIdGenerator implements IdGeneratorPort {
  next(prefix: string): string {
    return `${prefix}${nanoid(8)}`;
  }
}
