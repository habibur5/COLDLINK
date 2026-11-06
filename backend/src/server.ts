import { app } from "./app.js";
import { env } from "./config/env.js";
import { db } from "./db/client.js";

await db.$connect();

const server = app.listen(env.port, () => {
  console.info(`ColdLink API listening on port ${env.port}`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
