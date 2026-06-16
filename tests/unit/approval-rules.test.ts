import { describe, it, expect } from "vitest";
import {
  requiredApprovalLevel,
  approvalLevelLabel,
} from "@/lib/endurance/approval-rules";

describe("approval-rules", () => {
  it("roteia pelo valor estimado (limites inclusivos)", () => {
    expect(requiredApprovalLevel(0)).toBe("supervisor");
    expect(requiredApprovalLevel(5000)).toBe("supervisor");
    expect(requiredApprovalLevel(5000.01)).toBe("gerente");
    expect(requiredApprovalLevel(20000)).toBe("gerente");
    expect(requiredApprovalLevel(20000.01)).toBe("diretor");
    expect(requiredApprovalLevel(150000)).toBe("diretor");
  });

  it("trata entrada inválida como zero", () => {
    expect(requiredApprovalLevel(NaN)).toBe("supervisor");
  });

  it("rotula os níveis", () => {
    expect(approvalLevelLabel("supervisor")).toBe("Supervisor");
    expect(approvalLevelLabel("gerente")).toBe("Gerente");
    expect(approvalLevelLabel("diretor")).toBe("Diretor");
    expect(approvalLevelLabel("xpto")).toBe("xpto");
  });
});
