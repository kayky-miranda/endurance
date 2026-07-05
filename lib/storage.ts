import "server-only";
import { createHash, createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";

/**
 * Storage de objetos (imagens, XML fiscal, logos, carrosséis).
 *
 * Com as envs STORAGE_S3_* definidas, sobe para um bucket S3-compatível
 * (AWS S3 ou Cloudflare R2) via assinatura SigV4 nativa — sem SDK pesado.
 * Sem as envs, grava em public/ (dev/local). Em serverless o filesystem é
 * EFÊMERO, então o S3/R2 é obrigatório em produção para os assets não sumirem.
 */

const S3_ENDPOINT = process.env.STORAGE_S3_ENDPOINT; // R2: https://<acct>.r2.cloudflarestorage.com
const S3_REGION = process.env.STORAGE_S3_REGION || "auto";
const S3_BUCKET = process.env.STORAGE_S3_BUCKET;
const S3_KEY = process.env.STORAGE_S3_ACCESS_KEY_ID;
const S3_SECRET = process.env.STORAGE_S3_SECRET_ACCESS_KEY;
const S3_PUBLIC_BASE = process.env.STORAGE_PUBLIC_BASE_URL; // ex.: https://cdn.endurance.app

const USE_S3 = Boolean(S3_ENDPOINT && S3_BUCKET && S3_KEY && S3_SECRET);

export interface PutResult {
  key: string;
  url: string;
}

/** true quando o storage remoto (S3/R2) está configurado. */
export function isRemoteStorage(): boolean {
  return USE_S3;
}

const sha256hex = (s: Buffer | string) =>
  createHash("sha256").update(s).digest("hex");
const hmac = (key: Buffer | string, s: string) =>
  createHmac("sha256", key).update(s).digest();

/**
 * Núcleo do SigV4: deriva a signing key (HMAC encadeado) e assina a
 * string-to-sign. Exposto para teste contra o vetor oficial da AWS.
 */
export function sigV4Signature(opts: {
  secretKey: string;
  dateStamp: string; // YYYYMMDD
  region: string;
  service: string;
  stringToSign: string;
}): string {
  const kDate = hmac(`AWS4${opts.secretKey}`, opts.dateStamp);
  const kRegion = hmac(kDate, opts.region);
  const kService = hmac(kRegion, opts.service);
  const kSigning = hmac(kService, "aws4_request");
  return createHmac("sha256", kSigning).update(opts.stringToSign).digest("hex");
}

async function putS3(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<PutResult> {
  const url = new URL(`${S3_ENDPOINT}/${S3_BUCKET}/${key}`);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const service = "s3";
  const payloadHash = sha256hex(body);

  const canonicalUri = url.pathname
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const canonicalHeaders =
    `host:${url.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${S3_REGION}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256hex(canonicalRequest),
  ].join("\n");
  const signature = sigV4Signature({
    secretKey: S3_SECRET!,
    dateStamp,
    region: S3_REGION,
    service,
    stringToSign,
  });
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${S3_KEY}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "Content-Type": contentType,
    },
    // Buffer é um Uint8Array (BodyInit válido); cast evita o atrito de tipos
    // entre @types/node e a lib DOM do fetch.
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error("Storage S3 PUT falhou", {
      status: res.status,
      key,
      detail: detail.slice(0, 200),
    });
    throw new Error(`storage_s3_${res.status}`);
  }

  const publicUrl = S3_PUBLIC_BASE
    ? `${S3_PUBLIC_BASE.replace(/\/$/, "")}/${key}`
    : url.toString();
  return { key, url: publicUrl };
}

async function putLocal(key: string, body: Buffer): Promise<PutResult> {
  const dest = path.join(process.cwd(), "public", key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, body);
  return { key, url: `/${key}` };
}

/**
 * Grava um objeto e devolve a URL pública. `key` é o caminho lógico
 * (ex.: "campaigns/<id>/slide_1.png", "fiscal/<org>/<doc>.xml").
 */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<PutResult> {
  return USE_S3 ? putS3(key, body, contentType) : putLocal(key, body);
}
