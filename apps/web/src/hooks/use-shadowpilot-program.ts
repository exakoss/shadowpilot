"use client";

import type { SolanaClient } from "@solana/client";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
} from "@solana/kit";
import { useClusterState, useSolanaClient } from "@solana/react-hooks";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type ShadowPilotSolanaChain,
  useShadowPilotAuth,
} from "@/components/shadowpilot-auth-provider";
import {
  buildClaimTaskInstruction,
  buildCreateAndFundTaskInstructions,
  buildBuyerAuthoredSettlement,
  buildLiveMissions,
  buildLinkWorldVerificationInstruction,
  buildReleasePayoutInstruction,
  buildMintReceiptInstruction,
  buildReputationCommitment,
  buildSettlementInstructions,
  buildSubmitSessionInstruction,
  buildTracePointer,
  compactTaskStatus,
  computeMissionSettlement,
  decodeShadowPilotProgramState,
  deriveSessionReceiptAddress,
  hashTracePayload,
  lamportsToSolNumber,
  SHADOWPILOT_PROGRAM_ID,
  taskStatusTone,
  type ShadowPilotUsageRights,
  type EncodedProgramAccount,
  type LiveMission,
  type ShadowPilotProgramState,
} from "@/lib/shadowpilot-program";
import { getTaskLaneDefinition, getTaskLaneFromMission, type TaskLaneId } from "@/lib/task-lane";
import { resolveSubmissionManifestUrl } from "@/lib/submission-artifacts";

export type MissionSubmissionClip = {
  blob: Blob;
  durationMillis?: number;
  fileName: string;
  mimeType: string;
  source: "recorded" | "uploaded";
};

export type MissionSubmission = {
  collisionCount: number;
  interventionMillis: bigint;
  notes?: string;
  pathEfficiencyBps: number;
  trace: Array<{ at: number; x: number; y: number }>;
  videoClip?: MissionSubmissionClip | null;
};

export type TeleopSubmission = MissionSubmission;

export type BuyerSettlementInput = {
  reviewNotes?: string;
  score: number;
  usageRights: ShadowPilotUsageRights;
};

export type MissionMetrics = {
  claimClaimed: number;
  claimFinalized: number;
  claimPaid: number;
  claimSubmitted: number;
  claimed: number;
  closed: number;
  gatedTasks: number;
  open: number;
  paid: number;
  pilotProfiles: number;
  receipts: number;
  scored: number;
  submitted: number;
  taskClaims: number;
  total: number;
  worldVerifiedPilots: number;
};

type CreateTaskOverrides = {
  bundleUri?: string;
  environment?: string;
  payoutLamports?: bigint;
  title?: string;
  worldIdRequired?: boolean;
};

type QueryStatus = "error" | "idle" | "loading" | "success";

type QuerySnapshot<T> = {
  data: T | undefined;
  dataUpdatedAt?: number;
  error: unknown;
  isValidating: boolean;
  status: QueryStatus;
};

type QueryState<T> = QuerySnapshot<T> & {
  isError: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  refresh: () => Promise<T | undefined>;
};

type TransactionState = {
  error: unknown;
  isSending: boolean;
  signature: string | null;
};

type DeploymentState = {
  deployed: boolean;
  slot: bigint;
};

const WALLET_SIGNATURE_TIMEOUT_MS = 45_000;
const DEMO_RESET_EVENT = "shadowpilot:demo-reset";

function filterProgramStateAfterReset(
  programState: ShadowPilotProgramState,
  resetAfter: number,
): ShadowPilotProgramState {
  if (resetAfter <= 0) {
    return programState;
  }

  const taskRequests = programState.taskRequests.filter((task) => task.createdAt >= resetAfter);
  const taskAddresses = new Set(taskRequests.map((task) => task.address));
  const taskClaims = programState.taskClaims.filter((claim) => taskAddresses.has(claim.taskRequest));
  const claimAddresses = new Set(taskClaims.map((claim) => claim.address));

  return {
    ...programState,
    sessionReceipts: programState.sessionReceipts.filter((receipt) =>
      claimAddresses.has(receipt.taskClaim),
    ),
    taskAccessPolicies: programState.taskAccessPolicies.filter((policy) =>
      taskAddresses.has(policy.taskRequest),
    ),
    taskClaims,
    taskRequests,
  };
}

function createIdleQuery<T>(): QuerySnapshot<T> {
  return {
    data: undefined,
    error: null,
    isValidating: false,
    status: "idle",
  };
}

function beginRefresh<T>(current: QuerySnapshot<T>): QuerySnapshot<T> {
  return {
    ...current,
    error: null,
    isValidating: true,
    status: current.data === undefined ? "loading" : current.status,
  };
}

async function fetchDeploymentState(client: SolanaClient): Promise<DeploymentState> {
  const response = await client.runtime.rpc
    .getAccountInfo(SHADOWPILOT_PROGRAM_ID, { encoding: "base64" })
    .send();

  return {
    deployed: Boolean(response.value?.executable),
    slot: response.context.slot,
  };
}

async function fetchProgramState(
  client: SolanaClient,
  deployment: DeploymentState,
): Promise<ShadowPilotProgramState> {
  if (!deployment.deployed) {
    return decodeShadowPilotProgramState(false, []);
  }

  const accounts = await client.runtime.rpc
    .getProgramAccounts(SHADOWPILOT_PROGRAM_ID, {
      encoding: "base64",
    })
    .send();

  return decodeShadowPilotProgramState(
    true,
    accounts as readonly EncodedProgramAccount[],
  );
}

function buildMissionMetrics(
  missions: LiveMission[],
  programState: ShadowPilotProgramState | undefined,
): MissionMetrics {
  const metrics: MissionMetrics = {
    claimClaimed: 0,
    claimFinalized: 0,
    claimPaid: 0,
    claimSubmitted: 0,
    claimed: 0,
    closed: 0,
    gatedTasks: 0,
    open: 0,
    paid: 0,
    pilotProfiles: programState?.pilotProfiles.length ?? 0,
    receipts: programState?.sessionReceipts.length ?? 0,
    scored: 0,
    submitted: 0,
    taskClaims: programState?.taskClaims.length ?? 0,
    total: missions.length,
    worldVerifiedPilots: programState?.worldVerifications.length ?? 0,
  };

  for (const mission of missions) {
    metrics[mission.task.status] += 1;
    if (mission.accessPolicy?.worldIdRequired) {
      metrics.gatedTasks += 1;
    }
    if (mission.claim) {
      switch (mission.claim.status) {
        case "claimed":
          metrics.claimClaimed += 1;
          break;
        case "submitted":
          metrics.claimSubmitted += 1;
          break;
        case "finalized":
          metrics.claimFinalized += 1;
          break;
        case "paid":
          metrics.claimPaid += 1;
          break;
      }
    }
  }

  return metrics;
}

function resolvePrivyChain(endpoint: string): ShadowPilotSolanaChain {
  if (endpoint.includes("devnet")) {
    return "solana:devnet";
  }
  if (endpoint.includes("testnet")) {
    return "solana:testnet";
  }
  if (endpoint.includes("mainnet")) {
    return "solana:mainnet";
  }

  throw new Error(
    "Privy signing is wired for Solana devnet, testnet, and mainnet. Switch ShadowPilot back to devnet to transact here.",
  );
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function stringifyTransactionError(value: unknown) {
  if (!value) {
    return "unknown simulation error";
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, (_key, nestedValue) =>
    typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
  );
}

function formatSimulationFailure(error: unknown, logs: readonly string[] | null) {
  const logSummary = logs?.length ? ` Logs: ${logs.slice(-4).join(" | ")}` : "";
  return `${stringifyTransactionError(error)}.${logSummary}`;
}

function isAlreadyProcessedTransactionError(error: unknown) {
  const message = stringifyTransactionError(error);
  return message === "AlreadyProcessed" || /already processed|already been processed/i.test(message);
}

async function waitForWalletSignature<T>(signatureRequest: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          "Phantom did not return a signed transaction. Unlock Phantom, keep the approval popup open, and retry this action.",
        ),
      );
    }, WALLET_SIGNATURE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([signatureRequest, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function getSignedTransactionSignature(transaction: VersionedTransaction) {
  const [signatureBytes] = transaction.signatures;
  if (!signatureBytes) {
    throw new Error("The signed ShadowPilot transaction is missing a wallet signature.");
  }

  return getBase58Decoder().decode(signatureBytes);
}

export function useShadowPilotProgram() {
  const client = useSolanaClient();
  const cluster = useClusterState();
  const rpc = useMemo(() => createSolanaRpc(cluster.endpoint), [cluster.endpoint]);
  const web3Connection = useMemo(() => new Connection(cluster.endpoint, "confirmed"), [cluster.endpoint]);
  const { activeWallet, buildApiHeaders, configured, connectedWallet, signTransaction } =
    useShadowPilotAuth();
  const [deploymentSnapshot, setDeploymentSnapshot] = useState<QuerySnapshot<DeploymentState>>(
    () => createIdleQuery(),
  );
  const [stateSnapshot, setStateSnapshot] = useState<QuerySnapshot<ShadowPilotProgramState>>(
    () => createIdleQuery(),
  );
  const [transactionState, setTransactionState] = useState<TransactionState>({
    error: null,
    isSending: false,
    signature: null,
  });
  const [demoResetAfter, setDemoResetAfter] = useState(0);
  const refreshSequence = useRef(0);

  const refreshAll = useCallback(async () => {
    const requestId = refreshSequence.current + 1;
    refreshSequence.current = requestId;

    setDeploymentSnapshot((current) => beginRefresh(current));
    setStateSnapshot((current) => beginRefresh(current));

    try {
      const deployment = await fetchDeploymentState(client);
      if (refreshSequence.current !== requestId) {
        return undefined;
      }

      setDeploymentSnapshot({
        data: deployment,
        dataUpdatedAt: Date.now(),
        error: null,
        isValidating: false,
        status: "success",
      });

      const programState = await fetchProgramState(client, deployment);
      if (refreshSequence.current !== requestId) {
        return undefined;
      }

      setStateSnapshot({
        data: programState,
        dataUpdatedAt: Date.now(),
        error: null,
        isValidating: false,
        status: "success",
      });

      return {
        deployment,
        programState,
      };
    } catch (error) {
      if (refreshSequence.current !== requestId) {
        return undefined;
      }

      setDeploymentSnapshot({
        data: undefined,
        dataUpdatedAt: Date.now(),
        error,
        isValidating: false,
        status: "error",
      });
      setStateSnapshot({
        data: undefined,
        dataUpdatedAt: Date.now(),
        error,
        isValidating: false,
        status: "error",
      });

      return undefined;
    }
  }, [client]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshAll();
    }, 0);

    return () => {
      window.clearTimeout(refreshTimer);
      refreshSequence.current += 1;
    };
  }, [cluster.endpoint, refreshAll]);

  useEffect(() => {
    let cancelled = false;

    async function loadDemoReset() {
      try {
        const response = await fetch("/api/demo-reset", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as {
          resetAfter?: unknown;
        } | null;
        if (!cancelled && typeof payload?.resetAfter === "number") {
          setDemoResetAfter(Math.max(0, Math.floor(payload.resetAfter)));
        }
      } catch (error) {
        console.warn("ShadowPilot demo reset marker could not be loaded.", error);
      }
    }

    const handleResetChange = () => {
      void loadDemoReset();
    };

    void loadDemoReset();
    window.addEventListener(DEMO_RESET_EVENT, handleResetChange);

    return () => {
      cancelled = true;
      window.removeEventListener(DEMO_RESET_EVENT, handleResetChange);
    };
  }, []);

  async function refreshDeployment() {
    return (await refreshAll())?.deployment;
  }

  async function refreshProgramState() {
    const nextProgramState = (await refreshAll())?.programState;
    return nextProgramState ? filterProgramStateAfterReset(nextProgramState, demoResetAfter) : undefined;
  }

  async function resetDemoHistory() {
    const response = await fetch("/api/demo-reset", {
      body: JSON.stringify({}),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      resetAfter?: unknown;
    } | null;

    if (!response.ok || typeof payload?.resetAfter !== "number") {
      throw new Error("ShadowPilot could not reset the local demo history marker.");
    }

    setDemoResetAfter(Math.max(0, Math.floor(payload.resetAfter)));
    window.dispatchEvent(new Event(DEMO_RESET_EVENT));
    await refreshProgramState();
  }

  const unfilteredProgramState = stateSnapshot.data;
  const programState = unfilteredProgramState
    ? filterProgramStateAfterReset(unfilteredProgramState, demoResetAfter)
    : undefined;
  const missions = programState ? buildLiveMissions(programState) : [];
  const missionMetrics = buildMissionMetrics(missions, programState);
  const connectedMission = connectedWallet
    ? missions.find(
        (mission) =>
          mission.task.buyer === connectedWallet ||
          mission.task.assignedPilot === connectedWallet ||
          mission.claim?.pilot === connectedWallet,
      ) ?? null
    : null;
  const latestMission = missions[0] ?? null;
  const connectedPilotProfile = connectedWallet
    ? programState?.pilotProfiles.find((candidate) => candidate.wallet === connectedWallet) ?? null
    : null;
  const connectedWorldVerification = connectedWallet
    ? programState?.worldVerifications.find((candidate) => candidate.wallet === connectedWallet) ?? null
    : null;
  const latestReceipt =
    programState?.sessionReceipts.reduce<typeof programState.sessionReceipts[number] | null>(
      (currentLatest, candidate) =>
        candidate.mintedAt > (currentLatest?.mintedAt ?? -1) ? candidate : currentLatest,
      null,
    ) ?? null;
  const deploymentQuery: QueryState<DeploymentState> = {
    ...deploymentSnapshot,
    isError: deploymentSnapshot.status === "error",
    isLoading: deploymentSnapshot.status === "loading",
    isSuccess: deploymentSnapshot.status === "success",
    refresh: refreshDeployment,
  };
  const stateQuery: QueryState<ShadowPilotProgramState> = {
    ...stateSnapshot,
    data: programState,
    isError: stateSnapshot.status === "error",
    isLoading: stateSnapshot.status === "loading",
    isSuccess: stateSnapshot.status === "success",
    refresh: refreshProgramState,
  };

  async function sendInstructions(instructions: Instruction[]) {
    if (!configured) {
      throw new Error(
        "ShadowPilot signing is disabled until NEXT_PUBLIC_PRIVY_APP_ID is configured for this app.",
      );
    }
    if (!connectedWallet || !activeWallet) {
      throw new Error("Continue with Privy or connect Phantom before submitting ShadowPilot transactions.");
    }

    setTransactionState({
      error: null,
      isSending: true,
      signature: null,
    });

    try {
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
      const compiledTransaction = pipe(
        createTransactionMessage({ version: 0 }),
        (message) => setTransactionMessageFeePayer(address(connectedWallet), message),
        (message) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
        (message) => appendTransactionMessageInstructions(instructions, message),
        (message) => compileTransaction(message),
      );
      const simulation = await rpc
        .simulateTransaction(getBase64EncodedWireTransaction(compiledTransaction), {
          commitment: "confirmed",
          encoding: "base64",
          replaceRecentBlockhash: false,
          sigVerify: false,
        })
        .send();

      if (simulation.value.err) {
        throw new Error(
          `ShadowPilot transaction simulation failed: ${formatSimulationFailure(
            simulation.value.err,
            simulation.value.logs,
          )}`,
        );
      }

      const transactionBytes = new Uint8Array(getTransactionEncoder().encode(compiledTransaction));

      const signedTransactionBytes = await waitForWalletSignature(
        signTransaction({
          chain: resolvePrivyChain(cluster.endpoint),
          transaction: transactionBytes,
        }),
      );
      const signedTransaction = VersionedTransaction.deserialize(signedTransactionBytes);
      const signedTransactionSignature = getSignedTransactionSignature(signedTransaction);

      const signedSimulation = await web3Connection.simulateTransaction(
        signedTransaction,
        {
          commitment: "confirmed",
          replaceRecentBlockhash: false,
          sigVerify: true,
        },
      );

      if (signedSimulation.value.err) {
        if (isAlreadyProcessedTransactionError(signedSimulation.value.err)) {
          await web3Connection
            .confirmTransaction(
              {
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: Number(latestBlockhash.lastValidBlockHeight),
                signature: signedTransactionSignature,
              },
              "confirmed",
            )
            .catch(() => undefined);

          setTransactionState({
            error: null,
            isSending: false,
            signature: signedTransactionSignature,
          });

          await refreshAll();

          return signedTransactionSignature;
        }

        throw new Error(
          `Signed ShadowPilot transaction simulation failed: ${formatSimulationFailure(
            signedSimulation.value.err,
            signedSimulation.value.logs,
          )}`,
        );
      }

      let signature = signedTransactionSignature;
      try {
        signature = await web3Connection.sendRawTransaction(signedTransactionBytes, {
          maxRetries: 3,
          preflightCommitment: "confirmed",
          skipPreflight: false,
        });
      } catch (error) {
        if (!isAlreadyProcessedTransactionError(error)) {
          throw error;
        }
      }

      await web3Connection.confirmTransaction(
        {
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: Number(latestBlockhash.lastValidBlockHeight),
          signature,
        },
        "confirmed",
      );

      setTransactionState({
        error: null,
        isSending: false,
        signature,
      });

      await refreshAll();

      return signature;
    } catch (error) {
      setTransactionState({
        error,
        isSending: false,
        signature: null,
      });
      throw error;
    }
  }

  async function uploadSubmissionAsset(
    mission: LiveMission,
    submission: MissionSubmission,
    traceHashHex: string,
  ) {
    if (!submission.videoClip || !mission.claim) {
      return null;
    }

    const body = new FormData();
    body.append(
      "manifest",
      JSON.stringify({
        accessLink: mission.task.bundleUri,
        buyer: mission.task.buyer,
        claimAddress: mission.claim.address,
        environment: mission.task.environment,
        lane: getTaskLaneFromMission(mission).id,
        metrics: {
          collisionCount: submission.collisionCount,
          interventionMillis: Number(submission.interventionMillis),
          pathEfficiencyBps: submission.pathEfficiencyBps,
          success: true,
          tracePoints: submission.trace.length,
        },
        notes: submission.notes?.trim() ?? "",
        pilot: mission.claim.pilot,
        taskAddress: mission.task.address,
        taskTitle: mission.task.title,
        traceHash: traceHashHex,
        video: {
          durationMillis: submission.videoClip.durationMillis ?? Number(submission.interventionMillis),
          fileName: submission.videoClip.fileName,
          fileSizeBytes: submission.videoClip.blob.size,
          mimeType: submission.videoClip.mimeType || "video/webm",
          source: submission.videoClip.source,
        },
      }),
    );
    body.append("clip", submission.videoClip.blob, submission.videoClip.fileName);

    const response = await fetch("/api/submissions", {
      body,
      headers: buildApiHeaders(),
      method: "POST",
    });
    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errorPayload?.error ?? "The submission package could not be uploaded.");
    }

    return (await response.json()) as {
      traceUri: string;
    };
  }

  async function prepareConfidentialReview(
    mission: LiveMission,
    input: {
      reviewNotes?: string;
      settlement: ReturnType<typeof computeMissionSettlement>;
    },
  ) {
    if (!mission.claim) {
      throw new Error("No pilot claim was found for this mission.");
    }

    const response = await fetch("/api/reviews", {
      body: JSON.stringify({
        buyer: mission.task.buyer,
        claimAddress: mission.claim.address,
        currentReputationCommitment:
          mission.pilotProfile?.encryptedReputationCommitment ?? bytesToHex(await buildReputationCommitment(mission.claim.pilot)),
        environment: mission.task.environment,
        pilot: mission.claim.pilot,
        payoutLamports: input.settlement.payoutLamports.toString(),
        payoutTier: input.settlement.payoutTier,
        reviewNotes: input.reviewNotes?.trim() ?? "",
        score: input.settlement.score,
        submissionUrl: resolveSubmissionManifestUrl(mission.claim.traceUri),
        taskAddress: mission.task.address,
        taskTitle: mission.task.title,
        traceHash: mission.claim.traceHash,
        usageRights: input.settlement.usageRights,
      }),
      headers: buildApiHeaders({
        "content-type": "application/json",
      }),
      method: "POST",
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(
        errorPayload?.error ?? "The Arcium review package could not be sealed for this settlement.",
      );
    }

    return (await response.json()) as {
      nextReputationCommitment: string;
      reviewCommitment: string;
      reviewId: string;
    };
  }

  async function mintReceiptAsset(
    mission: LiveMission,
    input: {
      reviewCommitment: string;
      reviewId: string;
      reviewNotes?: string;
      settlement: ReturnType<typeof computeMissionSettlement>;
    },
  ) {
    if (!mission.claim) {
      throw new Error("No pilot claim was found for this mission.");
    }

    const response = await fetch("/api/receipts", {
      body: JSON.stringify({
        buyer: mission.task.buyer,
        claimAddress: mission.claim.address,
        environment: mission.task.environment,
        payoutLamports: input.settlement.payoutLamports.toString(),
        pilot: mission.claim.pilot,
        reviewCommitment: input.reviewCommitment,
        reviewId: input.reviewId,
        reviewNotes: input.reviewNotes?.trim() ?? "",
        score: input.settlement.score,
        submissionUrl: resolveSubmissionManifestUrl(mission.claim.traceUri),
        taskAddress: mission.task.address,
        taskTitle: mission.task.title,
        usageRights: input.settlement.usageRights,
      }),
      headers: buildApiHeaders({
        "content-type": "application/json",
      }),
      method: "POST",
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errorPayload?.error ?? "The cNFT receipt could not be minted.");
    }

    return (await response.json()) as {
      assetId: string;
      metadataUrl: string;
      receiptId: string;
      signature: string;
      treeAddress: string;
    };
  }

  async function createTaskFromTemplate(taskLane: TaskLaneId, overrides: CreateTaskOverrides = {}) {
    if (!connectedWallet) {
      throw new Error("Connect the buyer wallet on the active cluster to create a task.");
    }

    const template = getTaskLaneDefinition(taskLane).template;
    const taskSeed = BigInt(Date.now());
    const bundleUri = overrides.bundleUri ?? template.bundleUri;
    const environment = overrides.environment ?? template.environment;
    const payoutLamports = overrides.payoutLamports ?? template.payoutLamports;
    const title = overrides.title ?? template.title;
    const worldIdRequired = overrides.worldIdRequired ?? false;
    const bundleHashHex = bytesToHex(
      await hashTracePayload({
        bundleUri,
        environment,
        lane: taskLane,
        payoutLamports: payoutLamports.toString(),
        taskSeed: taskSeed.toString(),
        title,
        worldIdRequired,
      }),
    );
    const { instructions } = await buildCreateAndFundTaskInstructions({
      buyer: connectedWallet,
      bundleHashHex,
      bundleUri,
      environment,
      payoutLamports,
      taskSeed,
      title,
      worldIdRequired,
    });

    return sendInstructions(instructions);
  }

  async function createDemoTask() {
    return createTaskFromTemplate("remote_operation");
  }

  async function claimTask(taskAddress: string) {
    if (!connectedWallet) {
      throw new Error("Connect the pilot wallet on the active cluster to claim a task.");
    }

    const reputationCommitment = await buildReputationCommitment(connectedWallet);
    const { instruction } = await buildClaimTaskInstruction({
      pilot: connectedWallet,
      reputationCommitment,
      skillBand: 3,
      taskRequest: taskAddress,
    });

    return sendInstructions([instruction]);
  }

  async function linkWorldIdVerification(nullifierHashHex: string) {
    if (!connectedWallet) {
      throw new Error("Connect the pilot wallet on the active cluster before linking World ID.");
    }

    const reputationCommitment = await buildReputationCommitment(connectedWallet);
    const { instruction } = await buildLinkWorldVerificationInstruction({
      nullifierHashHex,
      pilot: connectedWallet,
      reputationCommitment,
      skillBand: connectedPilotProfile?.skillBand ?? 3,
    });

    return sendInstructions([instruction]);
  }

  async function submitMission(mission: LiveMission, teleop: MissionSubmission) {
    if (!connectedWallet) {
      throw new Error("Connect the pilot wallet on the active cluster to submit a trace.");
    }
    if (!mission.claim) {
      throw new Error("This mission has not been claimed yet.");
    }

    const traceHash = await hashTracePayload({
      claim: mission.claim.address,
      collisionCount: teleop.collisionCount,
      interventionMillis: teleop.interventionMillis.toString(),
      notes: teleop.notes?.trim() ?? "",
      pathEfficiencyBps: teleop.pathEfficiencyBps,
      trace: teleop.trace,
      video:
        teleop.videoClip
          ? {
              fileName: teleop.videoClip.fileName,
              fileSizeBytes: teleop.videoClip.blob.size,
              source: teleop.videoClip.source,
            }
          : null,
    });
    const traceHashHex = Array.from(traceHash)
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    const uploadedSubmission = await uploadSubmissionAsset(mission, teleop, traceHashHex);
    const traceUri = uploadedSubmission?.traceUri ?? buildTracePointer(mission.task.address, traceHashHex);
    const { instruction } = await buildSubmitSessionInstruction({
      collisionCount: teleop.collisionCount,
      interventionMillis: teleop.interventionMillis,
      pathEfficiencyBps: teleop.pathEfficiencyBps,
      pilot: connectedWallet,
      success: true,
      taskClaim: mission.claim.address,
      taskRequest: mission.task.address,
      traceHash,
      traceUri,
    });

    return sendInstructions([instruction]);
  }

  async function settleMission(mission: LiveMission, input?: BuyerSettlementInput) {
    if (!connectedWallet) {
      throw new Error("Connect the buyer wallet on the active cluster to settle the mission.");
    }
    if (!mission.claim) {
      throw new Error("No pilot claim was found for this mission.");
    }
    if (mission.task.buyer !== connectedWallet) {
      throw new Error("The connected wallet does not match this mission's buyer escrow account.");
    }

    const settlement = input
      ? buildBuyerAuthoredSettlement(mission.task, {
          score: input.score,
          usageRights: input.usageRights,
        })
      : computeMissionSettlement(mission.task, mission.claim);

    if (mission.task.status === "closed") {
      return;
    }

    const sessionReceipt = mission.receipt?.address ?? (await deriveSessionReceiptAddress(mission.claim.address));
    let reviewCommitment = mission.receipt?.reviewCommitment ?? "";
    let reviewId = `review-${mission.claim.address}`;

    if (mission.task.status === "submitted") {
      const preparedReview = await prepareConfidentialReview(mission, {
        reviewNotes: input?.reviewNotes,
        settlement,
      });
      reviewCommitment = preparedReview.reviewCommitment;
      reviewId = preparedReview.reviewId;

      const { finalizeSessionInstruction, releasePayoutInstruction } =
        await buildSettlementInstructions({
          buyer: connectedWallet,
          nextReputationCommitmentHex: preparedReview.nextReputationCommitment,
          pilotWallet: mission.claim.pilot,
          reviewCommitmentHex: preparedReview.reviewCommitment,
          settlement,
          taskClaim: mission.claim.address,
          taskRequest: mission.task.address,
        });

      await sendInstructions([finalizeSessionInstruction, releasePayoutInstruction]);
    } else if (mission.task.status === "scored") {
      await sendInstructions([
        buildReleasePayoutInstruction({
          buyer: connectedWallet,
          pilotWallet: mission.claim.pilot,
          taskClaim: mission.claim.address,
          taskRequest: mission.task.address,
        }),
      ]);
    } else if (mission.task.status !== "paid") {
      throw new Error("Only submitted, scored, or paid missions can be settled in ShadowPilot.");
    }

    if (mission.receipt?.receiptMint) {
      return;
    }

    const mintedReceipt = await mintReceiptAsset(mission, {
      reviewCommitment,
      reviewId,
      reviewNotes: input?.reviewNotes,
      settlement,
    });

    await sendInstructions([
      buildMintReceiptInstruction({
        buyer: connectedWallet,
        receiptMint: mintedReceipt.assetId,
        sessionReceipt,
        taskClaim: mission.claim.address,
        taskRequest: mission.task.address,
      }),
    ]);
  }

  return {
    claimTask,
    compactTaskStatus,
    connectedMission,
    connectedPilotProfile,
    connectedWorldVerification,
    connectedWallet,
    createDemoTask,
    createTaskFromTemplate,
    deploymentQuery,
    lamportsToSolNumber,
    latestMission,
    latestReceipt,
    linkWorldIdVerification,
    missionMetrics,
    missions,
    refresh: refreshProgramState,
    resetDemoHistory,
    settleMission,
    stateQuery,
    submitMission,
    taskStatusTone,
    transaction: transactionState,
  };
}
