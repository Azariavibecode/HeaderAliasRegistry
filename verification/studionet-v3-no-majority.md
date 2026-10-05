# StudioNet v3 bounded-consensus incident

Contract: [`0xd1ff96B6a3E520EB384Ca702dFc1b23ca0f633eB`](https://explorer-studio.genlayer.com/address/0xd1ff96B6a3E520EB384Ca702dFc1b23ca0f633eB)

The two auxiliary wallets successfully created pair `0`, proposed edge `0`, authenticated each of its three sources in separate consensus transactions, and sealed it. The semantic transaction then exhausted three recovery cycles with `CANCELED / NO_MAJORITY`; authoritative readback kept the edge `SEALED / PENDING`, proving rollback and no invalid state mutation.

Transactions:

- [Create pair](https://explorer-studio.genlayer.com/transactions/0xd66762d7e909fa473d632b7b6184b5f24fdec3fd0600d3fa9c877105f276ed4e)
- [Propose edge](https://explorer-studio.genlayer.com/transactions/0x07d508a7d7c750acd132bdeaf6c8c0d7101141f6090472979c35dffafa92db5e)
- [Authenticate old reference](https://explorer-studio.genlayer.com/transactions/0x61416d5455d45045bc73d2c798c3716114b8aba4d1173e1ec434c27f597aefba)
- [Authenticate new reference](https://explorer-studio.genlayer.com/transactions/0xad1d85a3fd8e1755f6af67aebeb023213f6138af34cf182991cdf9ad6f69debf)
- [Authenticate migration guide](https://explorer-studio.genlayer.com/transactions/0x660dba410c58a6d035eefc92d8542a5b613607051f43d1d0091ad4fc3987867f)
- [Seal edge](https://explorer-studio.genlayer.com/transactions/0x19af41cf220840828d82bd4dafd731a3cd508a73f524328d6e2aec587e51aea9)
- [Semantic verification — NO_MAJORITY](https://explorer-studio.genlayer.com/transactions/0x1e33004565457e0237943f61d30703f93d7a8e7cb94a9f1c7bd8fe1972fe4123)

Remediation: consensus now returns exactly one bounded `reason_code`, using an explicit failure-priority order. Deterministic contract code derives verdict and confidence from that code. This deployment is retained as rollback evidence and must not be submitted as the final deployment.
