import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { correctionReport } from "./correction-report.js";

dotenv.config();
const prisma = new PrismaClient();
try {
  process.stdout.write(
    `${JSON.stringify(await correctionReport(prisma), null, 2)}\n`,
  );
} catch {
  process.stderr.write(
    "Could not read correction feedback. Check the database connection and reporting permissions.\n",
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
