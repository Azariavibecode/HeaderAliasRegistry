# StudioNet verification attempt

Date: 2026-10-05  
Network: StudioNet (`61999`)  
Contract: [`0xBC026a16AFa77B9CB03F2124438dCD116E6A34F5`](https://explorer-studio.genlayer.com/address/0xBC026a16AFa77B9CB03F2124438dCD116E6A34F5)

## Completed setup

- Version pair `0` was created by auxiliary wallet A and finalized:
  [`0x6de35081…a7ab`](https://explorer-studio.genlayer.com/transactions/0x6de35081e2254af7a478e6ae889d163c3b4b5649ffd1b619af24bb9b9378a7ab)
- Edge `0` was proposed by auxiliary wallet B and finalized:
  [`0x685f30cf…230c`](https://explorer-studio.genlayer.com/transactions/0x685f30cfecfb29eb5b0e21057989599caded95a3d2d9e08efbf50ccea881230c)

## Infrastructure failure and recovery state

The first `verify_alias(0)` transaction reached `ACCEPTED / NO_MAJORITY` after the leader was replaced by `genvm_crash_handler` with a non-classifiable GenVM internal error:

- [`0xa19fbb45…c78`](https://explorer-studio.genlayer.com/transactions/0xa19fbb45273f6238c32dd66379d177bcd6a622fcda39c243c41c1ad1be114c78)

Authoritative readback after that failure proved no mutation: edge `0` remained `PROPOSED / PENDING` with empty confidence and reason.

One recovery transaction was then submitted:

- [`0xc2d67d0d…fa18`](https://explorer-studio.genlayer.com/transactions/0xc2d67d0d07386d50a39362b0fd7c1e9238678238ffbc05e618dd9e1b15ebfa18)

At the end of this attempt it remained `PENDING`, with no leader, validators or consensus data assigned. The edge again remained unchanged. No third verification transaction was submitted, avoiding duplicate queued execution.

## Current limitation

The live happy, collision, mismatch, poisoned-source and replay matrix is not yet complete. This file is an incident record, not successful E2E evidence. Continue only after the pending recovery transaction reaches a terminal state, then resume from authoritative contract readback.
