"use client";

import { type User, PrivyProvider, useIdentityToken, usePrivy } from "@privy-io/react-auth";
import {
  type ConnectedStandardSolanaWallet,
  toSolanaWalletConnectors,
  useSignTransaction,
  useWallets,
} from "@privy-io/react-auth/solana";
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
} from "@solana/kit";
import { VersionedTransaction } from "@solana/web3.js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const PRIVY_CLIENT_ID = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;
const SOLANA_WALLET_STORAGE_KEY = "shadowpilot:last-wallet";

export type ShadowPilotSolanaChain = "solana:devnet" | "solana:mainnet" | "solana:testnet";

const privySolanaRpcs = {
  "solana:devnet": {
    rpc: createSolanaRpc("https://api.devnet.solana.com"),
    rpcSubscriptions: createSolanaRpcSubscriptions("wss://api.devnet.solana.com"),
  },
  "solana:mainnet": {
    rpc: createSolanaRpc("https://api.mainnet-beta.solana.com"),
    rpcSubscriptions: createSolanaRpcSubscriptions("wss://api.mainnet-beta.solana.com"),
  },
  "solana:testnet": {
    rpc: createSolanaRpc("https://api.testnet.solana.com"),
    rpcSubscriptions: createSolanaRpcSubscriptions("wss://api.testnet.solana.com"),
  },
} as const;

type ShadowPilotSignTransactionInput = {
  chain: ShadowPilotSolanaChain;
  options?: {
    uiOptions?: {
      description?: string;
      showWalletUIs?: boolean;
      title?: string;
    };
  };
  transaction: Uint8Array;
};

type LocalDevPhantomWallet = {
  address: string;
  standardWallet: {
    name: "Phantom";
  };
};

type ShadowPilotActiveWallet = ConnectedStandardSolanaWallet | LocalDevPhantomWallet;

type PhantomSolanaProvider = {
  connect?: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString: () => string } }>;
  disconnect?: () => Promise<void>;
  isConnected?: boolean;
  isPhantom?: boolean;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  publicKey?: { toString: () => string } | null;
  signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
};

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomSolanaProvider;
    };
    solana?: PhantomSolanaProvider;
  }
}

type ShadowPilotAuthContextValue = {
  activeWallet: ShadowPilotActiveWallet | null;
  authActionPending: boolean;
  buildApiHeaders: (headers?: HeadersInit) => HeadersInit;
  authenticated: boolean;
  configured: boolean;
  connectedWallet: string | null;
  connectPhantom: () => void;
  identityToken: string | null;
  login: () => void;
  logout: () => Promise<void>;
  logoutActionPending: boolean;
  profileDisplayName: string | null;
  profileImageUrl: string | null;
  ready: boolean;
  signTransaction: (input: ShadowPilotSignTransactionInput) => Promise<Uint8Array>;
  userId: string | null;
  walletLabel: string | null;
  wallets: ConnectedStandardSolanaWallet[];
};

const fallbackAuthContext: ShadowPilotAuthContextValue = {
  activeWallet: null,
  authActionPending: false,
  buildApiHeaders: () => {
    throw new Error(
      "ShadowPilot private API access is disabled until NEXT_PUBLIC_PRIVY_APP_ID is configured.",
    );
  },
  authenticated: false,
  configured: false,
  connectedWallet: null,
  connectPhantom: () => {},
  identityToken: null,
  login: () => {},
  logout: async () => {},
  logoutActionPending: false,
  profileDisplayName: null,
  profileImageUrl: null,
  ready: true,
  signTransaction: async () => {
    throw new Error(
      "ShadowPilot signing is disabled until NEXT_PUBLIC_PRIVY_APP_ID is configured.",
    );
  },
  userId: null,
  walletLabel: null,
  wallets: [],
};

const ShadowPilotAuthContext = createContext<ShadowPilotAuthContextValue>(fallbackAuthContext);

function describeActiveWalletLabel(wallet: ShadowPilotActiveWallet | null) {
  if (!wallet) {
    return null;
  }

  return wallet.standardWallet.name ?? "Solana wallet";
}

function getProfileDisplayName(user: User | null) {
  if (!user) {
    return null;
  }

  return (
    user.farcaster?.displayName ??
    user.twitter?.name ??
    user.google?.name ??
    user.github?.name ??
    user.linkedin?.name ??
    user.spotify?.name ??
    user.tiktok?.name ??
    user.line?.name ??
    user.telegram?.firstName ??
    user.email?.address ??
    null
  );
}

function getProfileImageUrl(user: User | null) {
  if (!user) {
    return null;
  }

  return (
    user.farcaster?.pfp ??
    user.twitter?.profilePictureUrl ??
    user.line?.profilePictureUrl ??
    user.telegram?.photoUrl ??
    null
  );
}

async function disconnectWallets(wallets: ConnectedStandardSolanaWallet[]) {
  const disconnects = wallets.map(async (wallet) => {
    const disconnect = (wallet as { disconnect?: () => void | Promise<void> }).disconnect;
    if (typeof disconnect !== "function") {
      return;
    }

    await disconnect.call(wallet);
  });

  await Promise.allSettled(disconnects);
}

function clearStoredWalletConnection() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(SOLANA_WALLET_STORAGE_KEY);
  } catch (error) {
    console.warn("ShadowPilot could not clear the stored wallet connection.", error);
  }
}

function canUseLocalDevAuthFallback() {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
    return false;
  }

  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function getLocalPhantomProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  const provider = window.phantom?.solana ?? window.solana ?? null;
  return provider?.isPhantom ? provider : null;
}

function getLocalPhantomAddress(provider: PhantomSolanaProvider | null) {
  const publicKey = provider?.publicKey?.toString?.();
  return provider?.isConnected && publicKey ? publicKey : null;
}

function buildLocalPhantomWallet(address: string): LocalDevPhantomWallet {
  return {
    address,
    standardWallet: {
      name: "Phantom",
    },
  };
}

async function signWithLocalPhantomProvider(
  provider: PhantomSolanaProvider,
  transactionBytes: Uint8Array,
) {
  if (typeof provider.signTransaction !== "function") {
    throw new Error("The active Phantom wallet does not expose Solana transaction signing.");
  }

  const transaction = VersionedTransaction.deserialize(transactionBytes);
  const signedTransaction = await provider.signTransaction(transaction);
  return signedTransaction.serialize();
}

function ShadowPilotPrivyBridge({ children }: { children: React.ReactNode }) {
  const { authenticated, connectWallet, login, logout: privyLogout, ready, user } = usePrivy();
  const { identityToken } = useIdentityToken();
  const { wallets } = useWallets();
  const { signTransaction: signPrivyTransaction } = useSignTransaction();
  const [authActionPending, setAuthActionPending] = useState(false);
  const [localPhantomWallet, setLocalPhantomWallet] = useState<LocalDevPhantomWallet | null>(null);
  const [logoutActionPending, setLogoutActionPending] = useState(false);

  const privyWallet = wallets[0] ?? null;
  const activeWallet = localPhantomWallet ?? privyWallet;
  const visibleAuthActionPending = authActionPending && !activeWallet;

  const connectLocalPhantom = useCallback(async () => {
    const localProvider = canUseLocalDevAuthFallback() ? getLocalPhantomProvider() : null;
    if (!localProvider?.connect) {
      return false;
    }

    const result = await localProvider.connect();
    const address = result.publicKey?.toString() ?? getLocalPhantomAddress(localProvider);
    if (!address) {
      return false;
    }

    setLocalPhantomWallet(buildLocalPhantomWallet(address));
    return true;
  }, []);

  useEffect(() => {
    if (!canUseLocalDevAuthFallback()) {
      return;
    }

    const provider = getLocalPhantomProvider();
    if (!provider) {
      return;
    }

    const syncLocalPhantomWallet = () => {
      const address = getLocalPhantomAddress(provider);
      setLocalPhantomWallet(address ? buildLocalPhantomWallet(address) : null);
    };

    const onAccountChanged = () => syncLocalPhantomWallet();

    syncLocalPhantomWallet();
    void provider.connect?.({ onlyIfTrusted: true })
      .then(syncLocalPhantomWallet)
      .catch(() => {
        syncLocalPhantomWallet();
      });

    provider.on?.("connect", syncLocalPhantomWallet);
    provider.on?.("disconnect", syncLocalPhantomWallet);
    provider.on?.("accountChanged", onAccountChanged);

    return () => {
      provider.off?.("connect", syncLocalPhantomWallet);
      provider.off?.("disconnect", syncLocalPhantomWallet);
      provider.off?.("accountChanged", onAccountChanged);
    };
  }, []);

  const runAuthAction = useCallback(
    (action: () => void | Promise<void>) => {
      if (!ready || activeWallet || visibleAuthActionPending) {
        return;
      }

      setAuthActionPending(true);
      try {
        void Promise.resolve(action())
          .catch((error: unknown) => {
            console.warn("ShadowPilot wallet connection was interrupted.", error);
          })
          .finally(() => setAuthActionPending(false));
      } catch (error) {
        console.warn("ShadowPilot wallet connection could not start.", error);
        setAuthActionPending(false);
      }
    },
    [activeWallet, ready, visibleAuthActionPending],
  );

  const logout = useCallback(async () => {
    if (logoutActionPending) {
      return;
    }

    setLogoutActionPending(true);
    try {
      await disconnectWallets(wallets);
      await getLocalPhantomProvider()?.disconnect?.();
      setLocalPhantomWallet(null);
      clearStoredWalletConnection();
      await privyLogout();
    } catch (error) {
      console.warn("ShadowPilot sign out could not complete cleanly.", error);
      throw error;
    } finally {
      setLogoutActionPending(false);
    }
  }, [logoutActionPending, privyLogout, wallets]);

  const value = useMemo<ShadowPilotAuthContextValue>(
    () => ({
      activeWallet,
      authActionPending: visibleAuthActionPending,
      buildApiHeaders: (headers = {}) => {
        if (!activeWallet?.address) {
          throw new Error(
            "Connect a buyer or pilot wallet before loading ShadowPilot private media.",
          );
        }

        const normalizedHeaders = new Headers(headers);
        if (identityToken) {
          normalizedHeaders.set("authorization", `Bearer ${identityToken}`);
        } else if (canUseLocalDevAuthFallback()) {
          normalizedHeaders.set("x-shadowpilot-dev-auth", "1");
        } else {
          throw new Error("ShadowPilot is still preparing the secure Privy session. Try again in a moment.");
        }
        normalizedHeaders.set("x-shadowpilot-wallet", activeWallet.address);
        return normalizedHeaders;
      },
      authenticated,
      configured: true,
      connectedWallet: activeWallet?.address ?? null,
      connectPhantom: () =>
        runAuthAction(async () => {
          if (await connectLocalPhantom()) {
            return;
          }

          return connectWallet({
            description: "Connect the Phantom wallet for this ShadowPilot session.",
            walletChainType: "solana-only",
            walletList: ["phantom"],
          });
        }),
      identityToken,
      login: () =>
        runAuthAction(async () => {
          if (await connectLocalPhantom()) {
            return;
          }

          return login({ walletChainType: "solana-only" });
        }),
      logout,
      logoutActionPending,
      profileDisplayName: getProfileDisplayName(user),
      profileImageUrl: getProfileImageUrl(user),
      ready,
      signTransaction: async ({ chain, options, transaction }) => {
        if (!activeWallet) {
          throw new Error("Continue with Privy or connect Phantom before signing ShadowPilot actions.");
        }

        const localProvider = canUseLocalDevAuthFallback() ? getLocalPhantomProvider() : null;
        const localAddress = getLocalPhantomAddress(localProvider);
        if (localProvider && localAddress === activeWallet.address) {
          return signWithLocalPhantomProvider(localProvider, transaction);
        }

        if (!privyWallet) {
          throw new Error("Reconnect Phantom before signing ShadowPilot actions.");
        }

        const result = await signPrivyTransaction({
          chain,
          options,
          transaction,
          wallet: privyWallet,
        });

        return result.signedTransaction;
      },
      userId: user?.id ?? null,
      walletLabel: describeActiveWalletLabel(activeWallet),
      wallets,
    }),
    [
      activeWallet,
      visibleAuthActionPending,
      identityToken,
      authenticated,
      connectLocalPhantom,
      connectWallet,
      login,
      logout,
      logoutActionPending,
      privyWallet,
      runAuthAction,
      user,
      ready,
      signPrivyTransaction,
      wallets,
    ],
  );

  return (
    <ShadowPilotAuthContext.Provider value={value}>{children}</ShadowPilotAuthContext.Provider>
  );
}

export function ShadowPilotAuthProvider({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) {
    return (
      <ShadowPilotAuthContext.Provider value={fallbackAuthContext}>
        {children}
      </ShadowPilotAuthContext.Provider>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID || undefined}
      config={{
        appearance: {
          showWalletLoginFirst: true,
          walletList: ["phantom", "solflare", "backpack", "detected_solana_wallets"],
          walletChainType: "solana-only",
        },
        embeddedWallets: {
          showWalletUIs: true,
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors({ shouldAutoConnect: false }),
          },
        },
        loginMethods: ["wallet", "email", "twitter", "google", "apple"],
        solana: {
          rpcs: privySolanaRpcs,
        },
      }}
    >
      <ShadowPilotPrivyBridge>{children}</ShadowPilotPrivyBridge>
    </PrivyProvider>
  );
}

export function useShadowPilotAuth() {
  return useContext(ShadowPilotAuthContext);
}
