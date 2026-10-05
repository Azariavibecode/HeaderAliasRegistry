# Synthetic source registry

The bundled fixtures are synthetic and are used only to test the contract proof topology.

| Evidence | Fixture | Purpose |
|---|---|---|
| Old reference | `fixtures/old/headers.md` | v1 request correlation header |
| Equivalent new reference | `fixtures/new-equivalent/headers.md` | compatible renamed header |
| Mismatched new reference | `fixtures/new-mismatch/headers.md` | response retry field |
| Compatible migration guide | `fixtures/migration/guide.md` | exact v1-to-v2 rename scope |
| Mismatch guide | `fixtures/migration/mismatch-guide.md` | explicit incompatibility |
| Injection fixture | `fixtures/injection/headers.md` | adversarial document content |

Before live testing, publish stable paths through distinct immutable commits and record exact SHA-256 values. Evidence must state that the fixture demonstrates contract behavior, not real API runtime behavior.
