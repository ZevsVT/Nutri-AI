import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { importPackagedFoods } from "./packaged-food-import.js";
import { packagedFoodCatalog } from "./packaged-food-catalog.js";

dotenv.config();
const prisma = new PrismaClient();
try {
  const input: unknown = process.argv[2]
    ? JSON.parse(await readFile(process.argv[2], "utf8"))
    : packagedFoodCatalog;
  if (!Array.isArray(input) || input.length > 2000)
    throw new Error("Expected an array of at most 2000 reviewed products");
  const report = await importPackagedFoods(prisma, input);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.rejected) process.exitCode = 1;
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Import failed"}\n`,
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
