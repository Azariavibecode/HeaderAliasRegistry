import { createClient } from "../../DependencyPatchPermit/frontend/node_modules/genlayer-js/dist/index.js";
import { studionet } from "../../DependencyPatchPermit/frontend/node_modules/genlayer-js/dist/chains/index.js";
import { TransactionStatus } from "../../DependencyPatchPermit/frontend/node_modules/genlayer-js/dist/types/index.js";
import { privateKeyToAccount } from "../../DependencyPatchPermit/frontend/node_modules/viem/_esm/accounts/index.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const envPath = "../DependencyPatchPermit/.env";
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const contract = "0xBC026a16AFa77B9CB03F2124438dCD116E6A34F5";
const explorer = "https://explorer-studio.genlayer.com";
const keys = [process.env.TEST_WALLET_A_PRIVATE_KEY, process.env.TEST_WALLET_B_PRIVATE_KEY];
if (keys.some((key) => !/^(0x)?[0-9a-fA-F]{64}$/.test(key || ""))) throw new Error("Two auxiliary wallet keys are required");
const wallets = keys.map((key) => privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`));
if (wallets[0].address.toLowerCase() === wallets[1].address.toLowerCase()) throw new Error("Auxiliary wallets must differ");

const reader = createClient({ chain: studionet });
const writer = (wallet) => createClient({ chain: studionet, account: wallet });
const parse = async (name, args = []) => JSON.parse(await reader.readContract({ address: contract, functionName: name, args }));
const transactions = [];

async function write(wallet, functionName, args, label) {
  const hash = await writer(wallet).writeContract({ address: contract, functionName, args });
  const receipt = await reader.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, interval: 3000, retries: 100 });
  const status = receipt.status_name || receipt.status;
  const transaction = await reader.getTransaction({ hash });
  const resultName = transaction?.result_name || transaction?.resultName || transaction?.result?.name || "";
  if (status !== TransactionStatus.FINALIZED || (resultName && resultName !== "MAJORITY_AGREE")) {
    throw new Error(`${label} failed: ${status}/${resultName}`);
  }
  transactions.push({ label, hash, explorer_url: `${explorer}/transactions/${hash}`, actor: wallet.address,
                      status, result_name: resultName || "FINALIZED" });
  console.log(`${label}: ${hash}`);
}

const commits = {
  baseline: "f1e64a2b69c74e0e4d4184b2fe278f45a4cb5639",
  equivalent: "babd628ad8c9269423bb8135250f7b8a7b4e2cf3",
  mismatch: "cf3654b8ce67569e80dc8eb220327bbbd2bc0a89",
};
const digests = {
  baseline: "ddc233466c4bdd7c48584cca0680e3b9d7f578aaab3b9d7aab19a015470b1bb9",
  equivalentHeaders: "f66369299e4e8cb651107292c436c1ef60561726c38e77c767d293cb013eb616",
  equivalentMigration: "6a4fead87da31d352668ad195c9eea6fa21f91ba813696c0e71f8a1a572143c9",
  mismatchHeaders: "ff11a2f565044e20f96d4d4668f9b053928b54bcc4a47203395309973fb5d9a4",
  mismatchMigration: "cd1c0e52a77d1ff6c8ef9b325debe19f04d01d4153e9168cb513abca07738f85",
};
const source = (commit, path, digest, marker) => JSON.stringify({ owner: "Azariavibecode", repo: "HeaderAliasRegistry", commit, path, digest, marker });
const old = (marker, digest = digests.baseline) => source(commits.baseline, "/fixtures/e2e/docs/v1/headers.md", digest, marker);
const newEquivalent = (marker, digest = digests.equivalentHeaders) => source(commits.equivalent, "/fixtures/e2e/docs/v2/headers.md", digest, marker);
const migrationEquivalent = (marker) => source(commits.equivalent, "/fixtures/e2e/migration/v1-v2.md", digests.equivalentMigration, marker);
const newMismatch = source(commits.mismatch, "/fixtures/e2e/docs/v2/headers.md", digests.mismatchHeaders, "## HEADER Retry-Delay");
const migrationMismatch = source(commits.mismatch, "/fixtures/e2e/migration/v1-v2.md", digests.mismatchMigration, "## MIGRATION X-Request-Trace TO Retry-Delay");

const before = await parse("get_counts");
const pairId = BigInt(before.pair_count);
const firstEdge = BigInt(before.edge_count);
await write(wallets[0], "create_version_pair", ["acme-api-live", "v1", "v2", "Azariavibecode", "HeaderAliasRegistry", "ONE_TO_ONE"], "happy_create_version_pair");
const pair = await parse("get_pair", [pairId]);
if (pair.creator.toLowerCase() !== wallets[0].address.toLowerCase() || pair.published_edges !== 0) throw new Error("Pair readback mismatch");

await write(wallets[1], "propose_alias", [pairId, "X-Request-Trace", "Trace-Context", "REQUEST",
  old("## HEADER X-Request-Trace"), newEquivalent("## HEADER Trace-Context"),
  migrationEquivalent("## MIGRATION X-Request-Trace TO Trace-Context")], "happy_propose_alias");
await write(wallets[0], "verify_alias", [firstEdge], "happy_verify_alias");
let edge = await parse("get_edge", [firstEdge]);
if (edge.verdict !== "VERIFIED_ALIAS" || edge.state !== "VERIFIED") throw new Error(`Happy verification mismatch: ${JSON.stringify(edge)}`);
await write(wallets[1], "publish_alias", [firstEdge], "happy_publish_alias");
const resolution = await parse("resolve_alias", [pairId, "x-request-trace"]);
if (resolution.new_header !== "Trace-Context" || resolution.edge_id !== Number(firstEdge)) throw new Error("Alias resolution mismatch");

const sourceCollisionId = firstEdge + 1n;
await write(wallets[0], "propose_alias", [pairId, "X-Request-Trace", "Request-Correlation", "REQUEST",
  old("## HEADER X-Request-Trace"), newEquivalent("## HEADER Request-Correlation"),
  migrationEquivalent("## MIGRATION X-Request-Trace TO Request-Correlation")], "collision_propose_same_source");
await write(wallets[1], "verify_alias", [sourceCollisionId], "collision_verify_same_source");
const beforeSourceCollision = { counts: await parse("get_counts"), resolution: await parse("resolve_alias", [pairId, "X-Request-Trace"]) };
await write(wallets[0], "publish_alias", [sourceCollisionId], "collision_reject_source_slot");
const sourceCollision = await parse("get_edge", [sourceCollisionId]);
if (sourceCollision.state !== "COLLISION_BLOCKED" || sourceCollision.reason_code !== "SOURCE_SLOT_OCCUPIED") throw new Error("Source collision not blocked");
const afterSourceCollision = { counts: await parse("get_counts"), resolution: await parse("resolve_alias", [pairId, "X-Request-Trace"]) };
if (afterSourceCollision.counts.published_count !== beforeSourceCollision.counts.published_count || JSON.stringify(afterSourceCollision.resolution) !== JSON.stringify(beforeSourceCollision.resolution)) throw new Error("Source collision overwrote graph");

const targetCollisionId = firstEdge + 2n;
await write(wallets[1], "propose_alias", [pairId, "X-Legacy-Trace", "Trace-Context", "REQUEST",
  old("## HEADER X-Legacy-Trace"), newEquivalent("## HEADER Trace-Context"),
  migrationEquivalent("## MIGRATION X-Legacy-Trace TO Trace-Context")], "collision_propose_same_target");
await write(wallets[0], "verify_alias", [targetCollisionId], "collision_verify_same_target");
await write(wallets[1], "publish_alias", [targetCollisionId], "collision_reject_target_slot");
const targetCollision = await parse("get_edge", [targetCollisionId]);
if (targetCollision.state !== "COLLISION_BLOCKED" || targetCollision.reason_code !== "TARGET_SLOT_OCCUPIED") throw new Error("Target collision not blocked");
if (!(await parse("resolve_alias", [pairId, "X-Legacy-Trace"])).error) throw new Error("Target collision became resolvable");

const mismatchId = firstEdge + 3n;
await write(wallets[1], "propose_alias", [pairId, "X-Request-Trace", "Retry-Delay", "REQUEST",
  old("## HEADER X-Request-Trace"), newMismatch, migrationMismatch], "mismatch_propose_alias");
await write(wallets[0], "verify_alias", [mismatchId], "mismatch_verify_alias");
const mismatch = await parse("get_edge", [mismatchId]);
if (mismatch.verdict !== "SEMANTIC_MISMATCH" || mismatch.state !== "BLOCKED") throw new Error(`Mismatch path unsafe: ${JSON.stringify(mismatch)}`);
const graphBeforeMismatchPublish = await parse("resolve_alias", [pairId, "X-Request-Trace"]);
await write(wallets[1], "publish_alias", [mismatchId], "failure_publish_mismatch");
if (JSON.stringify(await parse("resolve_alias", [pairId, "X-Request-Trace"])) !== JSON.stringify(graphBeforeMismatchPublish)) throw new Error("Mismatch changed graph");

const poisonedId = firstEdge + 4n;
await write(wallets[0], "propose_alias", [pairId, "X-Poison-Trace", "Poison-Context", "REQUEST",
  old("## HEADER X-Request-Trace"), newEquivalent("## HEADER Trace-Context", "0".repeat(64)),
  migrationEquivalent("## MIGRATION X-Request-Trace TO Trace-Context")], "failure_propose_poisoned_digest");
await write(wallets[1], "verify_alias", [poisonedId], "failure_verify_poisoned_digest");
const poisoned = await parse("get_edge", [poisonedId]);
if (poisoned.verdict !== "SOURCE_UNVERIFIED" || poisoned.state !== "BLOCKED") throw new Error("Poisoned source did not fail closed");

const replayBefore = { pair: await parse("get_pair", [pairId]), edge: await parse("get_edge", [firstEdge]), counts: await parse("get_counts"), resolution: await parse("resolve_alias", [pairId, "X-Request-Trace"]) };
await write(wallets[0], "verify_alias", [firstEdge], "failure_replay_verification");
await write(wallets[1], "publish_alias", [firstEdge], "failure_replay_publication");
const replayAfter = { pair: await parse("get_pair", [pairId]), edge: await parse("get_edge", [firstEdge]), counts: await parse("get_counts"), resolution: await parse("resolve_alias", [pairId, "X-Request-Trace"]) };
if (JSON.stringify(replayBefore) !== JSON.stringify(replayAfter)) throw new Error("Terminal replay mutated state");

const after = await parse("get_counts");
const result = {
  generated_at: new Date().toISOString(), network: "StudioNet", chain_id: 61999, contract,
  contract_explorer_url: `${explorer}/address/${contract}`,
  wallets: { auxiliary_a: wallets[0].address, auxiliary_b: wallets[1].address },
  source_commits: commits, source_digests: digests, before, after,
  pair: await parse("get_pair", [pairId]), resolution: await parse("resolve_alias", [pairId, "X-Request-Trace"]),
  edges: { published: await parse("get_edge", [firstEdge]), source_collision: sourceCollision,
           target_collision: targetCollision, mismatch, poisoned }, transactions,
};
writeFileSync("verification/studionet-e2e.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
