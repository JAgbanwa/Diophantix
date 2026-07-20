import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { replayCertificate } from "../src/lib/prooflab/verifier.mjs";

const certificatePath = process.argv[2];
if (!certificatePath) {
  console.error("Usage: npm run replay-certificate -- path/to/prooflab-certificate.json");
  process.exitCode = 2;
} else {
  try {
    const certificate = JSON.parse(await readFile(resolve(certificatePath), "utf8"));
    const result = replayCertificate(certificate);
    if (!result.valid) {
      console.error(`INVALID: ${result.reason}`);
      process.exitCode = 1;
    } else {
      console.log(`VALID: ${certificate.verifier} certificate ${certificate.certificateHash}`);
    }
  } catch (error) {
    console.error(`Replay failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
