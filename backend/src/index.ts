import { buildApp } from "./app.js";

async function main() {
  const port = Number(process.env.PORT ?? 3000);
  const { app } = await buildApp();
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
