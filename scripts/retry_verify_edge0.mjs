import { createClient } from "../../DependencyPatchPermit/frontend/node_modules/genlayer-js/dist/index.js";
import { studionet } from "../../DependencyPatchPermit/frontend/node_modules/genlayer-js/dist/chains/index.js";
import { TransactionStatus } from "../../DependencyPatchPermit/frontend/node_modules/genlayer-js/dist/types/index.js";
import { privateKeyToAccount } from "../../DependencyPatchPermit/frontend/node_modules/viem/_esm/accounts/index.js";
import { readFileSync } from "node:fs";

for (const line of readFileSync("../DependencyPatchPermit/.env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.+)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
}
const key = process.env.TEST_WALLET_A_PRIVATE_KEY;
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const contract = "0xBC026a16AFa77B9CB03F2124438dCD116E6A34F5";
const reader = createClient({ chain: studionet });
const writer = createClient({ chain: studionet, account });
const before = JSON.parse(await reader.readContract({ address: contract, functionName: "get_edge", args: [0n] }));
if (before.state !== "PROPOSED") throw new Error(`Edge 0 is not recoverable: ${JSON.stringify(before)}`);
const hash = await writer.writeContract({ address: contract, functionName: "verify_alias", args: [0n] });
console.log(`retry_verify_alias: ${hash}`);
try {
  const receipt = await reader.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, interval: 3000, retries: 150 });
  const tx = await reader.getTransaction({ hash });
  console.log(JSON.stringify({ receipt, transaction: tx, edge: JSON.parse(await reader.readContract({ address: contract, functionName: "get_edge", args: [0n] })) }, null, 2));
} catch (error) {
  const tx = await reader.getTransaction({ hash });
  console.log(JSON.stringify({ timeout: String(error), transaction: tx, edge: JSON.parse(await reader.readContract({ address: contract, functionName: "get_edge", args: [0n] })) }, null, 2));
  process.exitCode = 2;
}
