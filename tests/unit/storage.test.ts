import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { sigV4Signature, isRemoteStorage } from "@/lib/storage";

/**
 * Confere a cadeia de assinatura SigV4 da lib contra uma reimplementação
 * independente do algoritmo documentado pela AWS (getSignatureKey + HMAC
 * final). Não é o vetor oficial da AWS — é um guard de consistência/regressão:
 * se alguém reordenar ou quebrar a derivação da signing key na lib, diverge
 * da referência abaixo e o teste falha.
 */
function referenceSig(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
  stringToSign: string,
): string {
  const h = (k: Buffer | string, s: string) =>
    createHmac("sha256", k).update(s).digest();
  const kDate = h(`AWS4${secretKey}`, dateStamp);
  const kRegion = h(kDate, region);
  const kService = h(kRegion, service);
  const kSigning = h(kService, "aws4_request");
  return createHmac("sha256", kSigning).update(stringToSign).digest("hex");
}

describe("storage SigV4", () => {
  it("a cadeia HMAC bate com a reimplementação de referência", () => {
    const cases = [
      ["secretAAA", "20240101", "us-east-1", "s3", "string-to-sign-1"],
      ["wJalr/EXAMPLE/KEY", "20150830", "auto", "s3", "AWS4-HMAC-SHA256\n..."],
      ["x", "20991231", "sa-east-1", "iam", "qualquer\nconteudo\naqui"],
    ] as const;

    for (const [secret, date, region, service, sts] of cases) {
      const mine = sigV4Signature({
        secretKey: secret,
        dateStamp: date,
        region,
        service,
        stringToSign: sts,
      });
      expect(mine).toBe(referenceSig(secret, date, region, service, sts));
      expect(mine).toMatch(/^[0-9a-f]{64}$/); // hex SHA-256
    }
  });

  it("é determinística (mesma entrada → mesma assinatura)", () => {
    const args = {
      secretKey: "k",
      dateStamp: "20240515",
      region: "us-east-1",
      service: "s3",
      stringToSign: "abc",
    };
    expect(sigV4Signature(args)).toBe(sigV4Signature(args));
  });

  it("sem envs STORAGE_S3_*, usa storage local", () => {
    expect(isRemoteStorage()).toBe(false);
  });
});
