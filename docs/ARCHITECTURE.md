# Architecture

## Proof obligation

Claim: the proposed target header is a safe semantic replacement for the source header within one exact old/new API version pair and declared transport direction.

Falsifiers are purpose, direction, value-model, scope or security differences; wrong source identity; ambiguous evidence; malformed validator output; or an occupied graph slot.

## Source authentication

Each edge binds old reference, new reference and migration guide locators. Every locator binds GitHub owner, repository, full commit, canonical path, SHA-256 and a unique section marker. Each `register_evidence` transaction independently resolves exactly one commit and tree object, verifies its exact blob, recomputes Git blob SHA-1 and SHA-256, extracts one bounded section and stores the consensus-equal snapshot.

All sources must belong to the authority registered for the version pair. The migration guide must be committed at the exact new-reference revision. `seal_edge` requires all three authenticated snapshots and makes the evidence set immutable.

## Reasoning topology

Comparative consensus reads only the sealed bounded sections, performs no web acquisition, and returns five explicit booleans plus a bounded verdict and reason. `VERIFIED_ALIAS` is accepted only when all booleans are true. The model cannot publish an edge or decide collision state.

## Bipartite graph consequence

Publishing reserves `pair + old_header`. A `ONE_TO_ONE` pair also reserves `pair + new_header`. Resolution reads only the published source slot. A verified competing edge becomes append-only `COLLISION_BLOCKED`; it cannot overwrite the prior edge.

The graph therefore converts semantic judgment into a meaningful downstream mapping while preserving deterministic uniqueness.

## Liveness and replay

Anyone can verify or publish. There are no deadlines. Terminal edges cannot be evaluated or published again. Source failure blocks the edge without occupying a graph slot, so a later independently sourced edge can be proposed.
