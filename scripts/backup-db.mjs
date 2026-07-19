// Dump lógico do Postgres (Neon) + upload para o R2. Ver BACKUP.md.
// Uso: node --env-file=.env scripts/backup-db.mjs
// Requer: pg_dump no PATH (PostgreSQL 16+) e envs DATABASE_URL / STORAGE_S3_*.
import { spawnSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const DB = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!DB) {
  console.error("DATABASE_URL ausente. Rode com: node --env-file=.env scripts/backup-db.mjs");
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 10);
mkdirSync("backups", { recursive: true });
const sqlPath = path.join("backups", `endurance-${stamp}.sql`);

console.log("→ pg_dump…");
const dump = spawnSync("pg_dump", ["--no-owner", "--no-privileges", "-f", sqlPath, DB], {
  stdio: ["ignore", "inherit", "inherit"],
});
if (dump.error || dump.status !== 0) {
  console.error("pg_dump falhou. Instale o cliente PostgreSQL 16+ e garanta que está no PATH.");
  process.exit(1);
}

const gz = gzipSync(readFileSync(sqlPath));
const gzPath = `${sqlPath}.gz`;
await import("node:fs/promises").then((fs) => fs.writeFile(gzPath, gz));
console.log(`✓ dump: ${gzPath} (${(statSync(gzPath).size / 1024 / 1024).toFixed(1)} MB)`);

// ---- Upload R2 (SigV4, sem SDK) ----
const ENDPOINT = process.env.STORAGE_S3_ENDPOINT;
const REGION = process.env.STORAGE_S3_REGION || "auto";
const BUCKET = process.env.STORAGE_S3_BUCKET;
const KEY_ID = process.env.STORAGE_S3_ACCESS_KEY_ID;
const SECRET = process.env.STORAGE_S3_SECRET_ACCESS_KEY;
if (!ENDPOINT || !BUCKET || !KEY_ID || !SECRET) {
  console.log("STORAGE_S3_* ausente — mantendo só o dump local.");
  process.exit(0);
}

const objectKey = `backups/endurance-${stamp}.sql.gz`;
const url = new URL(`${ENDPOINT.replace(/\/$/, "")}/${BUCKET}/${objectKey}`);
const now = new Date();
const amzDate = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
const shortDate = amzDate.slice(0, 8);
const payloadHash = createHash("sha256").update(gz).digest("hex");

const headers = {
  host: url.host,
  "x-amz-content-sha256": payloadHash,
  "x-amz-date": amzDate,
};
const signedHeaders = Object.keys(headers).sort().join(";");
const canonical = [
  "PUT",
  url.pathname,
  "",
  ...Object.keys(headers)
    .sort()
    .map((h) => `${h}:${headers[h]}`),
  "",
  signedHeaders,
  payloadHash,
].join("\n");
const scope = `${shortDate}/${REGION}/s3/aws4_request`;
const stringToSign = [
  "AWS4-HMAC-SHA256",
  amzDate,
  scope,
  createHash("sha256").update(canonical).digest("hex"),
].join("\n");
const hmac = (key, s) => createHmac("sha256", key).update(s).digest();
const kSigning = hmac(hmac(hmac(hmac(`AWS4${SECRET}`, shortDate), REGION), "s3"), "aws4_request");
const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

const res = await fetch(url, {
  method: "PUT",
  headers: {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  },
  body: gz,
});
if (!res.ok) {
  console.error(`Upload R2 falhou: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(`✓ enviado ao R2: ${objectKey}`);
