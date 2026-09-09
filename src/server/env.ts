function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export const env = {
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
  get jwtSecret() {
    return required("JWT_SECRET");
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get smtp() {
    return {
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
      secure: process.env.SMTP_SECURE === "true",
      from: process.env.EMAIL_FROM ?? "YPO SEA Learning <no-reply@example.com>",
    };
  },
};
