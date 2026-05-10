"use client";

import { address } from "@solana/kit";
import { useClusterState, useSolanaClient } from "@solana/react-hooks";
import { useEffect, useMemo, useState } from "react";

type WalletBalanceState = {
  error: string | null;
  fetching: boolean;
  lamports: bigint | null;
};

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return error ? String(error) : null;
}

function formatLamports(value: bigint | null) {
  if (value === null) {
    return null;
  }

  return `${(Number(value) / 1_000_000_000).toFixed(2)} SOL`;
}

export function useWalletBalance(walletAddress: string | null) {
  const client = useSolanaClient();
  const cluster = useClusterState();
  const [state, setState] = useState<WalletBalanceState>({
    error: null,
    fetching: false,
    lamports: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadBalance() {
      if (!walletAddress) {
        setState({
          error: null,
          fetching: false,
          lamports: null,
        });
        return;
      }

      setState((current) => ({
        ...current,
        error: null,
        fetching: true,
      }));

      try {
        const lamports = await client.actions.fetchBalance(address(walletAddress));
        if (cancelled) {
          return;
        }

        setState({
          error: null,
          fetching: false,
          lamports,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          error: formatError(error),
          fetching: false,
          lamports: null,
        });
      }
    }

    void loadBalance();

    return () => {
      cancelled = true;
    };
  }, [client.actions, cluster.endpoint, walletAddress]);

  const balanceLabel = useMemo(() => formatLamports(state.lamports), [state.lamports]);

  return {
    balanceLabel,
    error: state.error,
    fetching: state.fetching,
    lamports: state.lamports,
  };
}
