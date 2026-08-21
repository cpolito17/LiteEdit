import { describe, expect, it } from "vitest";

import { createBlankDocument } from "../document-model";
import { RECOVERY_SCHEMA_VERSION, restoreRecovery, type RecoveryRecord } from "./recovery-service";

describe("recovery service", () => {
  it("rejects unsupported and incomplete records without decoding pixels", async () => {
    const document = createBlankDocument({
      width: 8,
      height: 8,
      background: "transparent",
    });
    const incomplete: RecoveryRecord = {
      schemaVersion: RECOVERY_SCHEMA_VERSION,
      savedAt: 1,
      document,
      rasters: [],
    };
    await expect(restoreRecovery(incomplete)).rejects.toThrow("incomplete");
    await expect(
      restoreRecovery({ ...incomplete, schemaVersion: 999 as typeof RECOVERY_SCHEMA_VERSION }),
    ).rejects.toThrow("unsupported version");
  });
});
