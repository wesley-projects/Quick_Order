import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runChecks } from "../src/lib/checker/runner";

/**
 * One polling cycle from the command line.
 *
 *   npm run check          # only listings that are due
 *   npm run check -- --force   # every listing, ignoring intervals
 *   npm run check -- --loop 60 # keep going, every 60 seconds
 */
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const loopIndex = args.indexOf("--loop");
  const loopSeconds = loopIndex === -1 ? null : Number(args[loopIndex + 1] ?? 60);

  const once = async () => {
    const summary = await runChecks({ force });
    console.log(
      [
        new Date().toISOString(),
        `checked=${summary.checked}`,
        `skipped=${summary.skipped}`,
        `failed=${summary.failed}`,
        `events=${summary.events}`,
        `alerts=${summary.alerts}`,
        `${summary.durationMs}ms`,
      ].join("  "),
    );
  };

  await once();

  if (loopSeconds && loopSeconds > 0) {
    console.log(`Looping every ${loopSeconds}s. Ctrl-C to stop.`);
    setInterval(() => {
      once().catch((err) => console.error("cycle failed:", err));
    }, loopSeconds * 1000);
  } else {
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
