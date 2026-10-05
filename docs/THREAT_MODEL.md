# Threat model

## Protected state

- published alias resolution;
- source and target graph slots;
- exact source commitments;
- terminal edge verdicts and counters.

## Controls

- Commit/tree/blob/raw-byte/SHA-256 recomputation prevents locator substitution.
- Pair authority checks prevent cross-repository evidence.
- Unique markers prevent validators from silently choosing another section.
- Exact output schema, IDs, types and implication checks constrain prompt injection.
- Five positive predicates prevent partial equivalence from becoming a published alias.
- Source and target slot reservations prevent overwrite and one-to-one ambiguity.
- Terminal guards prevent evaluation and publication replay.
- The deployer is not stored and has no privileged path.

## Explicit non-claims

- Documentation evidence does not establish runtime API behavior.
- Synthetic fixtures are not independent real-world facts.
- The registry does not monitor future documentation changes.
- `MANY_TO_ONE` intentionally relaxes only target uniqueness; source uniqueness always applies.
