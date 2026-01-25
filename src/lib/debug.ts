export const isProdDebugEnabled = () =>
  process.env.ENABLE_PROD_DEBUG === "true" && process.env.VERCEL_ENV !== "production";
