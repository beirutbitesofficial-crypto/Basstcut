// Lays out the prebuilt app (from ./app) the way `next build` with output: "standalone" would,
// after the host's npm install. Nothing is compiled here.
//   ./.next/standalone/server.js  ← what Next.js-aware hosts look for
//   ./server.js, ./.next, ./public, ./node_modules  ← so `npm start` works from the root too
import { cpSync, readdirSync } from "node:fs";
for (const entry of readdirSync("app")) {
  if (entry === "package.json") continue;
  cpSync(`app/${entry}`, entry, { recursive: true, force: true });
}
cpSync("app", ".next/standalone", { recursive: true, force: true });
console.log("Prebuilt BASST CUT app ready (built by GitHub Actions): .next/standalone/server.js");
