# StudioNet v2 consensus-timeout record

Contract: [`0x770Ee73e47B70899fC385e514Af4cfcdC8605c8e`](https://explorer-studio.genlayer.com/address/0x770Ee73e47B70899fC385e514Af4cfcdC8605c8e)

The redesigned one-source-per-transaction acquisition flow finalized all three authenticated evidence snapshots and sealed edge `0`. This confirms that the earlier multi-source GenVM failure was removed.

Two subsequent `verify_alias(0)` transactions finalized with `TIMEOUT` while preserving the sealed edge unchanged:

- Initial attempt: the transaction hash is retained in the local E2E run output; the six successful setup hashes are recorded by the runner.
- Retry: [`0x159bea7df25bf6ee19248a884db802daf21a4fbdbdb6727fdae86ab47b810e9f`](https://explorer-studio.genlayer.com/transactions/0x159bea7df25bf6ee19248a884db802daf21a4fbdbdb6727fdae86ab47b810e9f)

Root cause: `prompt_comparative` added a second semantic comparison pass even though the evaluator already returns a closed, validated JSON schema without free-form text. The contract now uses `strict_eq(evaluate)` for this bounded result. This old deployment is retained as negative evidence and must not be submitted as the final deployment.
