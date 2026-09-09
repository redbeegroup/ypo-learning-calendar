import { randomBytes } from "node:crypto";

export function randomToken(): string {
  return randomBytes(32).toString("hex");
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
