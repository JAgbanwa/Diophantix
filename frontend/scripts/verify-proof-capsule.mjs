#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { replayProofCapsule } from "../src/lib/prooflab/verifier.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run verify:capsule -- path/to/proof-capsule.json");
  process.exitCode = 2;
} else {
  try {
    const capsule = JSON.parse(await readFile(resolve(file), "utf8"));
    const replay = replayProofCapsule(capsule);
    if (!replay.valid) {
      console.error(`INVALID: ${replay.reason}`);
      process.exitCode = 1;
    } else {
      console.log(`VALID ${replay.status} · ${replay.verifier}`);
      console.log(`certificate sha256:${replay.certificateHash}`);
      console.log(`capsule sha256:${replay.capsuleHash}`);
    }
  } catch (error) {
    console.error(`INVALID: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
