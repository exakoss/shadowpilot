# Scoring Circuit Stub

The MVP uses Arcium for compact confidential outputs, not for raw robotics payloads.

## Planned Inputs

- current reputation commitment
- task success flag
- intervention duration
- collision count
- path efficiency
- policy violation flag

## Planned Outputs

- final score in basis points
- payout tier
- next reputation commitment

The raw simulator trace and task bundle stay encrypted offchain and are referenced by hash and pointer from the onchain flow.

