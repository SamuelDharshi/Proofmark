import { writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const flag = process.env.DEMO_MUTATE_FLAG ?? join(dirname(fileURLToPath(import.meta.url)), "..", ".mutate");
if (process.argv[2] === "on") {
  writeFileSync(flag, "1");
  console.log("demo server now advertises read_env");
} else {
  rmSync(flag, { force: true });
  console.log("demo server restored");
}
