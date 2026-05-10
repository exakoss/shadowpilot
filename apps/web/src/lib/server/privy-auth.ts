import { PrivyClient, type LinkedAccount, type User } from "@privy-io/node";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";

let privyClient: PrivyClient | null =
  PRIVY_APP_ID && PRIVY_APP_SECRET
    ? new PrivyClient({
        appId: PRIVY_APP_ID,
        appSecret: PRIVY_APP_SECRET,
      })
    : null;

export class ShadowPilotRequestAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "ShadowPilotRequestAuthError";
    this.status = status;
  }
}

function getPrivyClient() {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new ShadowPilotRequestAuthError(
      "Privy server auth is not configured for ShadowPilot private API access.",
      503,
    );
  }

  if (!privyClient) {
    privyClient = new PrivyClient({
      appId: PRIVY_APP_ID,
      appSecret: PRIVY_APP_SECRET,
    });
  }

  return privyClient;
}

function getIdentityToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) {
    throw new ShadowPilotRequestAuthError(
      "Sign in with Privy before opening ShadowPilot private task data.",
      401,
    );
  }

  const bearerPrefix = /^Bearer\s+/i;
  if (!bearerPrefix.test(authorization)) {
    throw new ShadowPilotRequestAuthError(
      "ShadowPilot expected a Privy bearer token for this private request.",
      401,
    );
  }

  const token = authorization.replace(bearerPrefix, "").trim();
  if (!token) {
    throw new ShadowPilotRequestAuthError(
      "The Privy session token is missing from this private request.",
      401,
    );
  }

  return token;
}

function getRequestedWallet(request: Request) {
  const requestedWallet = request.headers.get("x-shadowpilot-wallet")?.trim();
  if (!requestedWallet) {
    throw new ShadowPilotRequestAuthError(
      "ShadowPilot expected the active wallet address on this private request.",
      400,
    );
  }

  return requestedWallet;
}

function isLocalhostHost(value: string | null) {
  if (!value) {
    return false;
  }

  const hostname = value.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isLocalDevRequest(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  const origin = request.headers.get("origin");
  let originIsLocal = !origin;
  if (origin) {
    try {
      originIsLocal = isLocalhostHost(new URL(origin).host);
    } catch {
      originIsLocal = false;
    }
  }

  return isLocalhostHost(request.headers.get("host")) && originIsLocal;
}

function allowLocalDevWalletAuth(request: Request) {
  if (!isLocalDevRequest(request)) {
    return false;
  }

  const authorization = request.headers.get("authorization")?.trim();
  return request.headers.get("x-shadowpilot-dev-auth") === "1" || !authorization;
}

function isLinkedSolanaWallet(account: LinkedAccount): account is Extract<
  LinkedAccount,
  { chain_type: "solana"; type: "wallet" }
> {
  return account.type === "wallet" && account.chain_type === "solana";
}

export type VerifiedPrivyWalletRequest = {
  requestedWallet: string;
  user: User;
};

export async function requirePrivyWallet(
  request: Request,
  expectedWallet?: string,
): Promise<VerifiedPrivyWalletRequest> {
  if (allowLocalDevWalletAuth(request)) {
    const requestedWallet = getRequestedWallet(request);
    if (expectedWallet && requestedWallet !== expectedWallet) {
      throw new ShadowPilotRequestAuthError(
        "The connected wallet does not match the task owner for this action.",
        403,
      );
    }

    return {
      requestedWallet,
      user: {
        id: `local-dev-wallet:${requestedWallet}`,
        linked_accounts: [],
      } as unknown as User,
    };
  }

  const identityToken = getIdentityToken(request);
  const requestedWallet = getRequestedWallet(request);
  const user = await getPrivyClient().users().get({ id_token: identityToken });

  const linkedWallet = user.linked_accounts.find(
    (account) => isLinkedSolanaWallet(account) && account.address === requestedWallet,
  );

  if (!linkedWallet) {
    throw new ShadowPilotRequestAuthError(
      "The active wallet is not linked to this Privy user.",
      403,
    );
  }

  if (expectedWallet && requestedWallet !== expectedWallet) {
    throw new ShadowPilotRequestAuthError(
      "The connected wallet does not match the task owner for this action.",
      403,
    );
  }

  return {
    requestedWallet,
    user,
  };
}

export async function requireSubmissionViewer(
  request: Request,
  submission: { buyer: string; pilot: string },
) {
  const auth = await requirePrivyWallet(request);
  if (auth.requestedWallet !== submission.buyer && auth.requestedWallet !== submission.pilot) {
    throw new ShadowPilotRequestAuthError(
      "This submission is only visible to the buyer and pilot attached to the task.",
      403,
    );
  }

  return auth;
}
