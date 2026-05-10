"use client";

import { autoDiscover, createClient } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";

import { ShadowPilotAuthProvider } from "@/components/shadowpilot-auth-provider";

const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const websocketEndpoint =
  process.env.NEXT_PUBLIC_SOLANA_WS_URL ??
  endpoint.replace("https://", "wss://").replace("http://", "ws://");

export const solanaClient = createClient({
  endpoint,
  websocketEndpoint,
  walletConnectors: autoDiscover(),
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ShadowPilotAuthProvider>
      <SolanaProvider
        client={solanaClient}
        walletPersistence={{
          autoConnect: false,
          storageKey: "shadowpilot:last-wallet",
        }}
      >
        {children}
      </SolanaProvider>
    </ShadowPilotAuthProvider>
  );
}
