# ShadowPilot

ShadowPilot is a private coordination layer for robotics teleoperation and humanoid data collection.

When an autonomous system gets stuck, ShadowPilot lets a verified human operator step in, complete the recovery, and get paid on Solana. The accepted intervention becomes a private, rights-bearing training trace instead of disappearing into an operations log.

Built for the Solana Colosseum hackathon.

## What It Does

ShadowPilot connects three workflows that are usually handled separately:

- **Fallback teleoperation:** robotics teams can post funded recovery tasks for human operators.
- **Human verification:** pilots can prove they are unique humans before accessing sensitive tasks.
- **Private data provenance:** accepted intervention traces can be scored privately, settled onchain, and issued as training-rights receipts.

The current MVP focuses on a simulated warehouse rover scenario, but the product direction is broader: remote robot operation, humanoid demonstration capture, private quality scoring, and licensable physical-AI datasets.

## Why It Matters

Robots and embodied AI systems still fail in edge cases. Those failures create two problems at once:

- teams need immediate human fallback to keep the task moving
- the resulting human intervention is valuable training data, but is often hard to verify, license, or reuse

ShadowPilot turns that recovery moment into a structured market: a buyer funds the task, a verified pilot completes it, confidential scoring evaluates the result, and Solana handles payout and provenance.

## Core Flow

1. A buyer creates a robotics fallback task and funds escrow.
2. A pilot connects a wallet and, when required, completes human verification.
3. The pilot claims the task and performs the intervention.
4. ShadowPilot records a trace hash, encrypted artifact pointers, and compact quality metrics.
5. Confidential scoring produces a score and reputation update without exposing raw task data.
6. The pilot is paid and the buyer receives a rights receipt for the accepted trace.

## Product Surfaces

- **Mission overview:** shared status, protocol rails, and network activity.
- **Buyer console:** task posting, escrow funding, review, settlement, and receipt state.
- **Pilot console:** task discovery, claim flow, teleoperation workspace, and submission.
- **Simulator:** a local rover environment for collecting intervention traces and metrics.

## Protocol Components

- **Solana + Anchor:** task accounts, escrow, claims, submissions, payout, and receipt state.
- **World ID:** optional unique-human verification for pilots.
- **Arcium:** compact private scoring and private reputation update path.
- **Metaplex compressed NFTs:** buyer-held training-rights receipts for accepted traces.
- **Encrypted offchain storage:** task bundles, video artifacts, and traces are referenced by hash and pointer.

## Repository Layout

```text
apps/web/              Next.js app for buyer, pilot, and mission-control surfaces
packages/shared/       Shared ShadowPilot domain types and sample data
programs/shadowpilot/  Anchor program for task, claim, payout, and receipt state
circuits/scoring/      Arcium scoring circuit notes and input/output shape
docs/                  Architecture and operator docs
runbooks/              Deployment and transaction runbooks
scripts/               Devnet bootstrap helpers
```

## Getting Started

Requirements:

- Node.js 20+
- pnpm 10+
- Rust and Cargo
- Solana tooling for program work

Install dependencies:

```bash
pnpm install
```

Copy the web environment template:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Start the web app:

```bash
pnpm dev
```

Then open:

- `http://localhost:3000/`
- `http://localhost:3000/buyer`
- `http://localhost:3000/pilot`

## Environment

The web app reads its public Solana, Privy, and World ID settings from `apps/web/.env.local`.

```env
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_PRIVY_CLIENT_ID=
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_WS_URL=wss://api.devnet.solana.com
NEXT_PUBLIC_WORLD_APP_ID=
NEXT_PUBLIC_WORLD_RP_ID=
NEXT_PUBLIC_WORLD_ENVIRONMENT=staging
NEXT_PUBLIC_WORLD_PILOT_ACTION=shadowpilot-pilot-human-proof
WORLD_RP_SIGNING_KEY=
```

World ID can be left unconfigured for non-gated local tasks.

## Scripts

```bash
pnpm dev              # Start the Next.js app
pnpm build            # Build the web app
pnpm lint             # Run ESLint
pnpm typecheck        # Generate Next types and run TypeScript checks
pnpm devnet:bootstrap # Prepare devnet state
pnpm devnet:seed      # Prepare and seed devnet state
```

## Status

ShadowPilot is an MVP built for a hackathon environment. The repository contains the product shell, local simulator flow, shared task data, Anchor program scaffold, private-scoring interface notes, and deployment runbooks. It is not production software and should be reviewed carefully before handling real robots, real operators, or valuable funds.

## Documentation

- [Architecture](docs/architecture.md)
- [Scoring circuit notes](circuits/scoring/README.md)
- [Runbooks](runbooks/README.md)
