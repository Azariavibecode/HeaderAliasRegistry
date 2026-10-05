# StudioNet E2E verification — final deployment

Contract: [`0xf9259299a6e7ee45D09dCd3d08dd69DCb091B68d`](https://explorer-studio.genlayer.com/address/0xf9259299a6e7ee45D09dCd3d08dd69DCb091B68d)

Network: StudioNet (`61999`)

Actors:

- Auxiliary A: `0x67A1A08Fc4cf7D05c859d0d3D8398a3A30B1677e`
- Auxiliary B: `0x7C87B10a3d43F3b3551414401F8b26B9F662bAB5`
- The deployer wallet did not perform test actions.

## Happy path

The pair and edge were created by auxiliary wallets. Each immutable GitHub source was authenticated independently, the edge was sealed, semantic verification reached `MAJORITY_AGREE`, and the alias was published.

- [Create version pair](https://explorer-studio.genlayer.com/transactions/0xd8ffed062231086d7f91f3b51341458f80406b0d0fe65a5f8801dcc558f5f152)
- [Propose alias](https://explorer-studio.genlayer.com/transactions/0x2b7b7ee8bd108943eb13d480714a0afc49cbf7b97a4c6bdfde3fc0e1f1e27e14)
- [Authenticate old reference](https://explorer-studio.genlayer.com/transactions/0x63a0e6bf2964c63f8038719a25e495f5bf015945e6b838358f7bfe7b1725f4f6)
- [Authenticate new reference](https://explorer-studio.genlayer.com/transactions/0xead8218d6433ba13f55ca65aa5d557b1389b80f80ec1a3b5cb490360d5a9feff)
- [Authenticate migration guide](https://explorer-studio.genlayer.com/transactions/0xd2390f47de70f2695fdec84fb2ca90d1bba77328f855f71ec4f5735ca4e69858)
- [Verify alias](https://explorer-studio.genlayer.com/transactions/0x3d30034bfdd0c7dabd3f7d036fff1c2d80c7383fe49255e4ab9a4ef240caf09b)

Authoritative readback: edge `0` is `PUBLISHED`, verdict `VERIFIED_ALIAS`, confidence `HIGH`, reason `FULLY_EQUIVALENT`. Resolving `x-request-trace` returns `Trace-Context` and edge `0`.

## Conflict paths

- Source collision: [verification](https://explorer-studio.genlayer.com/transactions/0x523eb2596ce1b1cae4615f6645c110c3bf7fdca9542b15758778a965b14159d6), [blocked publish](https://explorer-studio.genlayer.com/transactions/0xb77d01daba44697376722ba9b400adc1e8127a58c0c8a7deee15b05ebeded063). Edge `1` is `COLLISION_BLOCKED / SOURCE_SLOT_OCCUPIED`.
- Target collision: [verification](https://explorer-studio.genlayer.com/transactions/0xe3910a8acbc4979ec58fa76bc99d5cd73120ab702719a36539f29c41dc48a2a7), [blocked publish](https://explorer-studio.genlayer.com/transactions/0xf7ec498a6510ce0261e0cbfaa3850e5f9bce679f7965908f8e53f51ad592db18). Edge `2` is `COLLISION_BLOCKED / TARGET_SLOT_OCCUPIED`.

Neither attempt changed the canonical mapping.

## Semantic failure

The candidate mapped a request trace identifier to a response retry-delay list.

- [Semantic verification](https://explorer-studio.genlayer.com/transactions/0x48361cb71aec1498ad1275e562c0b413def2a2f7ee64eb11cefc4d07bf1cd33b)
- [Rejected publish attempt](https://explorer-studio.genlayer.com/transactions/0x70e8773b0f48a14bd970fb67b481e6b01348b891a3dcab99654abcb8bee05915)

Edge `3` is `BLOCKED / SEMANTIC_MISMATCH / DIRECTION_CHANGED`. The canonical mapping remained unchanged.

## Adversarial source integrity

Edge `4` supplied an all-zero SHA-256 for the new reference.

- [Poisoned evidence attempt](https://explorer-studio.genlayer.com/transactions/0x8ba8d8ae2b39cdda8bf2f1d2311063968a93cbe74297b1409ce6cc3249b54bda)
- [Incomplete seal attempt](https://explorer-studio.genlayer.com/transactions/0x02cdcb730c85229e87ea941d8a494726f58ab2b894cb59f1f1b9f75f58af1f27)

No new-reference snapshot was stored and the edge remained `PROPOSED / PENDING`.

## Replay protection

The complete pair, edge, counts and resolution state was captured before and after these calls and remained byte-for-byte equivalent:

- [Repeat verify](https://explorer-studio.genlayer.com/transactions/0x29ad3e4b24ad7e0507dcdab56df3b4fdb0c962116fafacdc8d99f84a5730808f)
- [Repeat publish](https://explorer-studio.genlayer.com/transactions/0x0ca0bba1d3ef3efdc074adbee6ca5db2c512febb3fe4681c102433e97b3517c9)
- [Repeat evidence registration](https://explorer-studio.genlayer.com/transactions/0xbf71737818d8715daa0d377ed56e01cd6dba33d24093d49b35beb5a5a0c2eaf3)

## Final counters

`pair_count=1`, `edge_count=5`, `published_count=1`, `collision_count=2`, `blocked_count=1`.

Machine-readable authoritative readback and transaction links are in [`studionet-e2e-v2.json`](./studionet-e2e-v2.json).
