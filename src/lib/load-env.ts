// Loads .env for plain Node processes (worker, scripts). Next.js loads it on its own.
import { existsSync } from "node:fs";
if (existsSync(".env") && typeof (process as any).loadEnvFile === "function") {
  try { (process as any).loadEnvFile(".env"); } catch { /* ignore malformed lines */ }
}
