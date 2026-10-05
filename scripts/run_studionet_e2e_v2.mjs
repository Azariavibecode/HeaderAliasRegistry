import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { privateKeyToAccount } from "viem/accounts";
import { writeFileSync } from "node:fs";
const keys = [process.env.TEST_WALLET_A_PRIVATE_KEY, process.env.TEST_WALLET_B_PRIVATE_KEY];
if (keys.some((key) => !/^(0x)?[0-9a-fA-F]{64}$/.test(key || ""))) throw new Error("Two auxiliary keys required");
const wallets = keys.map((key) => privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`));
const contract = "0x770Ee73e47B70899fC385e514Af4cfcdC8605c8e";
const explorer = "https://explorer-studio.genlayer.com";
const reader = createClient({ chain: studionet });
const writer = (wallet) => createClient({ chain: studionet, account: wallet });
const parse = async (name, args = []) => JSON.parse(await reader.readContract({ address: contract, functionName: name, args }));
const transactions = [];

async function write(wallet, functionName, args, label) {
  const hash = await writer(wallet).writeContract({ address: contract, functionName, args });
  console.log(`${label}_submitted: ${hash}`);
  const receipt = await reader.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, interval: 3000, retries: 120 });
  const tx = await reader.getTransaction({ hash });
  const status = receipt.status_name || receipt.status;
  const resultName = tx?.result_name || tx?.resultName || tx?.result?.name || "";
  if (status !== TransactionStatus.FINALIZED || (resultName && resultName !== "MAJORITY_AGREE")) throw new Error(`${label}: ${status}/${resultName}`);
  transactions.push({ label, hash, explorer_url: `${explorer}/transactions/${hash}`, actor: wallet.address, status, result_name: resultName || "FINALIZED" });
  console.log(`${label}: ${hash}`);
}

const commits = { baseline: "f1e64a2b69c74e0e4d4184b2fe278f45a4cb5639", equivalent: "babd628ad8c9269423bb8135250f7b8a7b4e2cf3", mismatch: "cf3654b8ce67569e80dc8eb220327bbbd2bc0a89" };
const digests = { baseline: "ddc233466c4bdd7c48584cca0680e3b9d7f578aaab3b9d7aab19a015470b1bb9", equivalentHeaders: "f66369299e4e8cb651107292c436c1ef60561726c38e77c767d293cb013eb616", equivalentMigration: "6a4fead87da31d352668ad195c9eea6fa21f91ba813696c0e71f8a1a572143c9", mismatchHeaders: "ff11a2f565044e20f96d4d4668f9b053928b54bcc4a47203395309973fb5d9a4", mismatchMigration: "cd1c0e52a77d1ff6c8ef9b325debe19f04d01d4153e9168cb513abca07738f85" };
const src = (commit, path, digest, marker) => JSON.stringify({ owner: "Azariavibecode", repo: "HeaderAliasRegistry", commit, path, digest, marker });
const old = (marker, digest = digests.baseline) => src(commits.baseline, "/fixtures/e2e/docs/v1/headers.md", digest, marker);
const newer = (marker, digest = digests.equivalentHeaders) => src(commits.equivalent, "/fixtures/e2e/docs/v2/headers.md", digest, marker);
const migration = (marker) => src(commits.equivalent, "/fixtures/e2e/migration/v1-v2.md", digests.equivalentMigration, marker);
const mismatchNew = src(commits.mismatch, "/fixtures/e2e/docs/v2/headers.md", digests.mismatchHeaders, "## HEADER Retry-Delay");
const mismatchMigration = src(commits.mismatch, "/fixtures/e2e/migration/v1-v2.md", digests.mismatchMigration, "## MIGRATION X-Request-Trace TO Retry-Delay");

async function acquire(edgeId, prefix) {
  for (const [index, slot] of ["OLD_REFERENCE", "NEW_REFERENCE", "MIGRATION_GUIDE"].entries()) {
    await write(wallets[index % 2], "register_evidence", [edgeId, slot], `${prefix}_register_${slot.toLowerCase()}`);
    const evidence = await parse("get_evidence", [edgeId, slot]);
    if (evidence.status !== "VERIFIED" || evidence.slot !== slot || !/^[0-9a-f]{64}$/.test(evidence.digest)) throw new Error(`${prefix} evidence readback failed`);
  }
  await write(wallets[1], "seal_edge", [edgeId], `${prefix}_seal`);
  if ((await parse("get_edge", [edgeId])).state !== "SEALED") throw new Error(`${prefix} seal failed`);
}

const before = await parse("get_counts");
if (before.pair_count !== 0 || before.edge_count !== 0) throw new Error(`Expected fresh deployment: ${JSON.stringify(before)}`);
await write(wallets[0], "create_version_pair", ["acme-api-live-v2", "v1", "v2", "Azariavibecode", "HeaderAliasRegistry", "ONE_TO_ONE"], "happy_create_pair");
const pairId = 0n;

await write(wallets[1], "propose_alias", [pairId, "X-Request-Trace", "Trace-Context", "REQUEST", old("## HEADER X-Request-Trace"), newer("## HEADER Trace-Context"), migration("## MIGRATION X-Request-Trace TO Trace-Context")], "happy_propose");
await acquire(0n, "happy");
await write(wallets[0], "verify_alias", [0n], "happy_verify");
if ((await parse("get_edge", [0n])).verdict !== "VERIFIED_ALIAS") throw new Error("Happy verdict mismatch");
await write(wallets[1], "publish_alias", [0n], "happy_publish");
const resolution = await parse("resolve_alias", [pairId, "x-request-trace"]);
if (resolution.new_header !== "Trace-Context" || resolution.edge_id !== 0) throw new Error("Happy resolution mismatch");

await write(wallets[0], "propose_alias", [pairId, "X-Request-Trace", "Request-Correlation", "REQUEST", old("## HEADER X-Request-Trace"), newer("## HEADER Request-Correlation"), migration("## MIGRATION X-Request-Trace TO Request-Correlation")], "source_collision_propose");
await acquire(1n, "source_collision"); await write(wallets[1], "verify_alias", [1n], "source_collision_verify");
const graphBeforeSource = await parse("resolve_alias", [pairId, "X-Request-Trace"]);
await write(wallets[0], "publish_alias", [1n], "source_collision_publish_attempt");
const sourceCollision = await parse("get_edge", [1n]);
if (sourceCollision.state !== "COLLISION_BLOCKED" || sourceCollision.reason_code !== "SOURCE_SLOT_OCCUPIED" || JSON.stringify(await parse("resolve_alias", [pairId, "X-Request-Trace"])) !== JSON.stringify(graphBeforeSource)) throw new Error("Source collision invariant failed");

await write(wallets[1], "propose_alias", [pairId, "X-Legacy-Trace", "Trace-Context", "REQUEST", old("## HEADER X-Legacy-Trace"), newer("## HEADER Trace-Context"), migration("## MIGRATION X-Legacy-Trace TO Trace-Context")], "target_collision_propose");
await acquire(2n, "target_collision"); await write(wallets[0], "verify_alias", [2n], "target_collision_verify");
await write(wallets[1], "publish_alias", [2n], "target_collision_publish_attempt");
const targetCollision = await parse("get_edge", [2n]);
if (targetCollision.state !== "COLLISION_BLOCKED" || targetCollision.reason_code !== "TARGET_SLOT_OCCUPIED" || !(await parse("resolve_alias", [pairId, "X-Legacy-Trace"])).error) throw new Error("Target collision invariant failed");

await write(wallets[1], "propose_alias", [pairId, "X-Request-Trace", "Retry-Delay", "REQUEST", old("## HEADER X-Request-Trace"), mismatchNew, mismatchMigration], "mismatch_propose");
await acquire(3n, "mismatch"); await write(wallets[0], "verify_alias", [3n], "mismatch_verify");
const mismatch = await parse("get_edge", [3n]);
if (mismatch.verdict !== "SEMANTIC_MISMATCH" || mismatch.state !== "BLOCKED") throw new Error("Mismatch not blocked");
const graphBeforeMismatch = await parse("resolve_alias", [pairId, "X-Request-Trace"]);
await write(wallets[1], "publish_alias", [3n], "mismatch_publish_attempt");
if (JSON.stringify(await parse("resolve_alias", [pairId, "X-Request-Trace"])) !== JSON.stringify(graphBeforeMismatch)) throw new Error("Mismatch changed graph");

await write(wallets[0], "propose_alias", [pairId, "X-Poison-Trace", "Poison-Context", "REQUEST", old("## HEADER X-Request-Trace"), newer("## HEADER Trace-Context", "0".repeat(64)), migration("## MIGRATION X-Request-Trace TO Trace-Context")], "poisoned_propose");
await write(wallets[1], "register_evidence", [4n, "OLD_REFERENCE"], "poisoned_register_old");
await write(wallets[0], "register_evidence", [4n, "NEW_REFERENCE"], "poisoned_register_new_attempt");
if (!(await parse("get_evidence", [4n, "NEW_REFERENCE"])).error || (await parse("get_edge", [4n])).state !== "PROPOSED") throw new Error("Poisoned evidence was stored");
await write(wallets[1], "seal_edge", [4n], "poisoned_seal_attempt");
if ((await parse("get_edge", [4n])).state !== "PROPOSED") throw new Error("Incomplete poisoned edge sealed");

const replayBefore = { pair: await parse("get_pair", [0n]), edge: await parse("get_edge", [0n]), counts: await parse("get_counts"), resolution: await parse("resolve_alias", [0n, "X-Request-Trace"]) };
await write(wallets[0], "verify_alias", [0n], "replay_verify_attempt");
await write(wallets[1], "publish_alias", [0n], "replay_publish_attempt");
await write(wallets[0], "register_evidence", [0n, "OLD_REFERENCE"], "replay_evidence_attempt");
const replayAfter = { pair: await parse("get_pair", [0n]), edge: await parse("get_edge", [0n]), counts: await parse("get_counts"), resolution: await parse("resolve_alias", [0n, "X-Request-Trace"]) };
if (JSON.stringify(replayBefore) !== JSON.stringify(replayAfter)) throw new Error("Replay mutated state");

const result = { generated_at: new Date().toISOString(), network: "StudioNet", chain_id: 61999, contract, contract_explorer_url: `${explorer}/address/${contract}`, wallets: { auxiliary_a: wallets[0].address, auxiliary_b: wallets[1].address }, source_commits: commits, source_digests: digests, before, after: await parse("get_counts"), pair: await parse("get_pair", [0n]), resolution: await parse("resolve_alias", [0n, "X-Request-Trace"]), edges: { published: await parse("get_edge", [0n]), source_collision: sourceCollision, target_collision: targetCollision, mismatch, poisoned: await parse("get_edge", [4n]) }, transactions };
writeFileSync("verification/studionet-e2e-v2.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
