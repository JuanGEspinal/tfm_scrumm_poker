import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { loadEnvFile } from "./loadEnv.js";

async function main() {
  loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), "../.env"));
  const port = Number(process.env.PORT ?? 3000);
  const { app } = await buildApp();
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
