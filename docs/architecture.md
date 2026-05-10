# ShadowPilot Architecture

This repo starts from the MVP flow captured in the main README:

1. Buyer creates and funds a fallback task.
2. A verified pilot claims the task.
3. The pilot submits an intervention trace.
4. ShadowPilot records compact metrics for private scoring.
5. Payout and rights issuance finalize the session.

## Current Scaffold

- `apps/web`: Next.js product shell for the buyer, pilot, and mission-control surfaces
- `packages/shared`: shared domain types and seeded demo data
- `programs/shadowpilot`: Anchor source scaffold for task, claim, payout, and receipt accounts
- `circuits/scoring`: placeholder inputs and outputs for the Arcium scoring layer

## Next Implementation Slices

1. Wire wallet connection and cluster state into the web shell.
2. Install the Solana and Anchor CLIs locally so the program can build and test.
3. Add typed client generation for the Anchor IDL.
4. Replace seeded task data with real account fetches on localnet/devnet.

