import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const backendDirectory = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(backendDirectory, "../.env") });

const port = Number(process.env.DB_PORT ?? 3306);
const databaseUrl = new URL("mysql://localhost");
databaseUrl.hostname = process.env.DB_HOST ?? "localhost";
databaseUrl.port = String(port);
databaseUrl.username = process.env.DB_USER ?? "";
databaseUrl.password = process.env.DB_PASSWORD ?? "";
databaseUrl.pathname = `/${process.env.DB_NAME ?? ""}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl.toString(),
  },
});
