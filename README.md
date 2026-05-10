# ShadowPilot

ShadowPilot is the private human layer for robotics and physical AI.

When an autonomous system gets stuck, a verified human can step in, complete the recovery, and get paid on Solana. The intervention becomes a private, licensable training trace instead of a one-off support event.

## One-Sentence Pitch

ShadowPilot lets robotics teams pay verified humans for private fallback interventions, while turning every accepted intervention into provable training-data rights.

## Hackathon Thesis

For Frontier, we should optimize for one clean "aha" moment:

1. A simulated robot fails.
2. A verified human takes over.
3. The intervention is scored privately.
4. The human is paid instantly on Solana.
5. A rights receipt is minted for the accepted trace.

That is much stronger than pitching a generic data marketplace. It is a live autonomy-gap product first, with the data flywheel emerging naturally from usage.

## Recommended MVP

The MVP should focus on one scenario only:

- A buyer posts a fallback request for a simulated warehouse robot.
- A pilot claims the task after proving they are a real human.
- The pilot teleoperates the robot through a short blocked scenario.
- ShadowPilot records the intervention trace and compact quality metrics.
- Arcium computes a private quality score and private reputation update.
- Solana releases escrowed payment to the pilot.
- A compressed NFT is minted as the buyer's training-rights receipt.

## Why This Scenario

We should not start with real drones, real warehouses, or hardware integration.

The warehouse-robot simulation gives us:

- A legible demo for judges in under 30 seconds
- No regulatory burden
- Simple keyboard or joystick controls
- Easy trajectory scoring
- A believable path from fallback assistance to training data

## Product Wedge

Beachhead user:

- Robotics startups and physical-AI teams that need human fallback data before full autonomy

Immediate value:

- Human intervention on demand
- Verified supply of real operators
- Private handling of sensitive task context
- Instant payment and provenance

Long-term value:

- A marketplace for intervention traces, demonstrations, and quality-assured robotics data
- A portable reputation layer for human pilots
- A private coordination rail for robotics fleets

## Core Users

### Buyer

A robotics developer or fleet operator who needs help recovering a failed task and wants usage rights to the resulting trace.

### Pilot

A verified human operator who claims a task, completes the intervention, and earns payment plus reputation.

### Judge / Viewer

A hackathon demo viewer who needs to understand the system in one glance.

## In Scope for MVP

- One simulated robot environment
- One buyer flow
- One pilot flow
- Wallet connection
- Human verification gate
- Onchain escrow and payout
- Private scoring with Arcium
- Private reputation update with Arcium
- Encrypted offchain storage for task/session payloads
- cNFT receipt for accepted intervention rights

## Explicitly Out of Scope

- Real robot hardware integration
- Live drone operations
- Open bidding between many pilots
- Multi-party disputes and arbitration
- Streaming video inside confidential compute
- Full robotics training pipeline
- Enterprise admin tools
- Fiat payments
- Cross-chain support

## Recommended Demo Story

Use a 2D top-down warehouse rover.

Demo setup:

- The rover starts in autonomous mode.
- It encounters an ambiguous obstacle or blocked path.
- Autonomy fails and requests human fallback.
- A pilot accepts the task and drives the rover to the goal.
- The system shows "private score computed," payout released, and rights receipt minted.

Why rover over arm for MVP:

- Faster to build
- Easier controls
- Cleaner visual readability
- Easier scoring model
- Less time lost on simulator complexity

## User Flow

### Buyer Flow

1. Connect wallet.
2. Create a fallback request.
3. Deposit escrow.
4. Upload encrypted task bundle.
5. Wait for a pilot submission.
6. Review accepted trace summary.
7. Receive rights receipt.

### Pilot Flow

1. Connect wallet.
2. Complete human verification.
3. View available tasks.
4. Claim a task.
5. Teleoperate the robot.
6. Submit the trace.
7. Receive payout and reputation update.

## Technical Architecture

### Frontend

- Next.js app for landing page, buyer dashboard, pilot dashboard, and simulator surface

### Wallet and Auth

- Phantom Connect for wallet onboarding and low-friction login
- World ID for unique-human verification

### Solana

- One Anchor program for task creation, claim, completion, payout, and receipt hooks

### Confidential Compute

- One Arcium circuit for private scoring and private reputation updates

### Storage

- Encrypted task bundles and session traces stored offchain
- Only hashes, pointers, and compact outputs referenced onchain

### Provenance

- Metaplex compressed NFT minted to represent accepted data-rights receipt

## Smart Contract Scope

Keep the onchain program intentionally small.

Primary accounts:

- `TaskRequest`
- `PilotProfile`
- `TaskClaim`
- `SessionReceipt`

Core instructions:

- `create_task`
- `fund_task`
- `claim_task`
- `submit_session`
- `finalize_session`
- `release_payout`
- `mint_receipt`

## Arcium Scope

Do not push large robotics payloads into Arcium.

Use Arcium only for compact decision logic:

- Input:
  - pilot reputation
  - success flag
  - intervention time
  - collision count
  - path efficiency
  - policy-violation flag
- Output:
  - private final score
  - payout tier
  - updated private reputation

The raw trace remains encrypted offchain.

## Data Model

### Task Request

- task id
- buyer wallet
- payout amount
- encrypted task bundle pointer
- task bundle hash
- status

### Pilot Profile

- wallet
- world verification marker
- encrypted reputation reference
- public skill tags

### Session Submission

- task id
- pilot wallet
- encrypted trace pointer
- trace hash
- compact metrics
- status

### Receipt Metadata

- task id
- buyer wallet
- pilot wallet
- accepted score band
- trace hash
- usage rights
- timestamp

## UX Priorities

The demo should feel like a product, not a protocol test.

Priority order:

1. Clear robot failure state
2. Smooth claim-and-control flow
3. Strong payout confirmation
4. Clear private-scoring moment
5. Clean rights/provenance display

If time gets tight, cut protocol surface before cutting usability.

## Open-Source and Composability Angle

The MVP should position ShadowPilot as more than a single app.

Open-source components we can ship:

- a minimal simulator adapter
- a client SDK for creating fallback requests
- an event schema for intervention traces
- the Anchor program
- the Arcium scoring circuit

That gives us a stronger Frontier story around composability.

## Business Model

Short term:

- Take rate on successful interventions
- Premium private pools for enterprise buyers

Medium term:

- Usage-based pricing for licensed intervention traces
- Subscription analytics and quality tooling for fleet operators

Long term:

- Reputation, routing, and coordination infrastructure for physical-AI labor markets

## Demo Script

### Part 1: Problem

"Robots still fail in edge cases. When they do, companies need a human in the loop. Today that intervention is operationally messy and the resulting data is usually lost."

### Part 2: Product

"ShadowPilot turns fallback intervention into a private, onchain market. Verified humans can step in, get paid instantly, and the resulting trace becomes a provable training asset."

### Part 3: Walkthrough

1. Buyer posts a task and funds escrow.
2. Pilot verifies humanness and claims the task.
3. Pilot teleoperates the rover to recovery.
4. Arcium computes the score privately.
5. Solana releases payout.
6. ShadowPilot mints the rights receipt.

### Part 4: Vision

"This starts with simulated warehouse robots, but expands to broader physical-AI fallback, review, and demonstration markets."

## Build Order

### Phase 1: Product Shell

- landing page
- buyer dashboard shell
- pilot dashboard shell
- simulator canvas placeholder

### Phase 2: Happy-Path Marketplace

- connect wallet
- create and fund task
- list available tasks
- claim task
- task status timeline

### Phase 3: Simulator and Trace Recording

- rover environment
- keyboard control
- trace recorder
- compact metric generation

### Phase 4: Confidential Scoring

- Arcium circuit
- finalize flow
- private score and reputation output

### Phase 5: Payout and Provenance

- release escrow
- mint cNFT receipt
- receipt viewer

### Phase 6: Demo Polish

- better motion and visual hierarchy
- seeded sample tasks
- stable end-to-end demo path
- 3-minute submission video

## Suggested Repo Shape

When implementation starts, this repo should likely grow into:

```text
apps/
  web/
programs/
  shadowpilot/
packages/
  simulator/
  sdk/
  shared/
circuits/
  scoring/
docs/
  demo-script.md
  architecture.md
```

## Sprint Plan

### April 24-26, 2026

- lock scope
- define UI flows
- scaffold app and Anchor workspace

### April 27-May 1, 2026

- implement buyer and pilot happy paths
- build rover simulator
- record traces and metrics

### May 2-5, 2026

- integrate Arcium scoring
- integrate payout flow
- mint receipt asset

### May 6-8, 2026

- polish UX
- prepare seeded demo data
- rehearse narrative

### May 9-11, 2026

- fix bugs
- record final demo
- package submission materials

## What Success Looks Like

The MVP is successful if a judge can understand, in one uninterrupted flow, that:

- real humans are uniquely verified
- private task context stays protected
- the intervention is useful right now
- Solana handles money and provenance
- every intervention becomes licensable training data

If we preserve that narrative discipline, ShadowPilot feels like a startup, not just a stack demo.
