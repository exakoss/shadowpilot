# ShadowPilot Demo Script

## Local Run

```bash
pnpm dev
```

Open these routes in the browser:

- `http://localhost:3000/`
- `http://localhost:3000/buyer`
- `http://localhost:3000/pilot`

For the cleanest presentation, keep buyer and pilot in separate browser profiles or windows so each Phantom wallet can stay on its own account.

## Preflight

- Confirm Phantom is on Solana devnet for both wallets.
- Fund the buyer with enough devnet SOL for the posted payout plus transaction fees. The demo minimum is `0.25 SOL`.
- Fund the pilot with a small devnet SOL balance for claim and submission fees.
- Use a non-World-gated task unless `NEXT_PUBLIC_WORLD_APP_ID`, `NEXT_PUBLIC_WORLD_RP_ID`, and `WORLD_RP_SIGNING_KEY` are configured.

## Live Flow

1. Start on `/` and frame the product as the private human layer for robotics.
2. Open `/buyer`, connect the Buyer Phantom wallet through Privy, and stay on devnet.
3. In `Post a robotics task`, choose `Remote robot operation`.
4. Paste a control link, leave `Require World ID human proof` off for the first test, keep or set the payout to `0.25 SOL`, and click `Post task`.
5. Approve the Buyer wallet transaction. This creates the task and funds escrow on devnet.
6. Open `/pilot`, connect the Pilot Phantom wallet through Privy, select the new public task, and click `Claim mission`.
7. Approve the Pilot wallet transaction. The task should move from open to claimed.
8. Let the pilot workspace open the local recording lane. If the browser blocks camera access, allow camera for `localhost`.
9. Finish the local run and click `Finish and submit task`.
10. Approve the Pilot wallet transaction. The task should move to buyer review.
11. Return to `/buyer`, open the review queue, set the score and usage rights, and click the settlement button.
12. Approve the Buyer wallet transaction for review finalization and payout release.
13. Approve the final Buyer wallet transaction that records the cNFT receipt.
14. Show the final state:
    - confidential review is sealed
    - payout is released to the pilot
    - buyer-held cNFT rights receipt is minted as the last step
    - receipt, trace hash, payout, rights holder, and event ledger are visible

## Reset

- Post a fresh task for each clean devnet run. Current devnet state starts clean when there are zero ShadowPilot program accounts.

## Talk Track

- The robot fails in autonomy mode.
- A verified human claims the fallback.
- The intervention trace is captured privately.
- Compact metrics feed confidential scoring.
- Solana handles escrow, payout, and provenance.
- The pilot receives payment.
- The buyer receives the accepted trace as a rights-bearing cNFT receipt.
