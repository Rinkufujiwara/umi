// Copies the static site into dist/ for Cloudflare Pages (no bundling: the app runs as plain ES modules).
// Server code stays out of dist/: functions/ is picked up by Wrangler from the repo root, server/ is bundled into it.
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const OUT = "dist";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of readdirSync(".")) if (/\.(html|css|js)$/.test(f)) cpSync(f, `${OUT}/${f}`);

writeFileSync(`${OUT}/_headers`, `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Cross-Origin-Opener-Policy: same-origin-allow-popups
`);
console.log("dist/:", readdirSync(OUT).join(" "));
