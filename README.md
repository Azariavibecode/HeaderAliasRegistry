# HeaderAliasRegistry

HeaderAliasRegistry is a contract-only GenLayer Intelligent Contract for publishing collision-free HTTP header rename mappings between exact API documentation revisions.

Validators authenticate immutable GitHub evidence and judge whether an old and new header preserve purpose, direction, value model, migration scope and security. Deterministic bipartite graph slots then prevent ambiguous one-to-many or many-to-one mappings.

## Why GenLayer

A textual rename cannot establish semantic compatibility. Two descriptions may use different wording while preserving behavior, or share vocabulary while changing request/response direction, units, cardinality or security meaning. GenLayer consensus performs this bounded comparison; deterministic contract code owns identity and graph uniqueness.

## Proof boundary

The contract proves consistency between exact publisher-controlled documentation revisions. It does not prove live API or gateway behavior. Bundled evidence is explicitly synthetic test material.

## Architecture

```text
version pair
  → proposed semantic edge
  → VERIFIED | BLOCKED
  → deterministic graph-slot publication
  → PUBLISHED | COLLISION_BLOCKED
```

This is a bipartite alias registry, not a court, deadline process, active-head lineage or single-use permit.

`VERIFIED_ALIAS` requires all five findings to be true:

- same purpose;
- same request/response direction;
- same value model, including encoding, unit and cardinality;
- migration scope matches the exact version pair;
- security is not weakened.

Any false, missing, malformed, unavailable or disagreeing observation fails closed. Even a verified edge cannot publish if its source slot is occupied; under `ONE_TO_ONE`, its target slot must also be empty.

## Public API

```text
create_version_pair(...)
propose_alias(...)
verify_alias(edge_id)
publish_alias(edge_id)
resolve_alias(pair_id, old_header)
get_pair(pair_id)
get_edge(edge_id)
get_counts()
```

There is no owner, administrator, allowlist, deployer privilege or clock dependency. The main wallet only deploys; auxiliary wallets and stewards can create and test their own version pairs.

## Verification

```bash
python -m pytest -q
```

Target runtime: GenLayer `0.2.16`. No frontend is included.

See [architecture](docs/ARCHITECTURE.md), [threat model](docs/THREAT_MODEL.md), [source registry](verification/source-registry.md) and [local verification](verification/local-verification.md).
