import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { createTreeV2, mintV2, mplBubblegum, parseLeafFromMintV2Transaction } from "@metaplex-foundation/mpl-bubblegum";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, keypairIdentity, none, publicKey } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { Keypair } from "@solana/web3.js";

import {
  readBubblegumTreeRecord,
  type ReceiptRecord,
  writeBubblegumTreeRecord,
} from "@/lib/server/shadowpilot-storage";

const DEVNET_RPC_URL = "https://api.devnet.solana.com";
const DEVNET_DEPLOYER_KEYPAIR_PATH = path.join(
  homedir(),
  ".config",
  "shadowpilot",
  "devnet",
  "deployer.json",
);

async function loadDeployerKeypair() {
  const secretKey = Uint8Array.from(
    JSON.parse(await readFile(DEVNET_DEPLOYER_KEYPAIR_PATH, "utf8")) as number[],
  );
  return Keypair.fromSecretKey(secretKey);
}

async function createBubblegumClient() {
  const deployer = await loadDeployerKeypair();
  const umi = createUmi(DEVNET_RPC_URL).use(mplBubblegum());
  const identity = fromWeb3JsKeypair(deployer);
  umi.use(keypairIdentity(identity));
  return umi;
}

async function ensureReceiptTree() {
  const umi = await createBubblegumClient();

  try {
    const existing = await readBubblegumTreeRecord();
    return {
      merkleTree: existing.merkleTree,
      umi,
    };
  } catch {
    const merkleTree = generateSigner(umi);
    const builder = await createTreeV2(umi, {
      canopyDepth: 8,
      maxBufferSize: 64,
      maxDepth: 14,
      merkleTree,
    });

    await builder.sendAndConfirm(umi, {
      confirm: {
        commitment: "finalized",
      },
    });

    await writeBubblegumTreeRecord({
      createdAt: new Date().toISOString(),
      merkleTree: merkleTree.publicKey,
    });

    return {
      merkleTree: merkleTree.publicKey,
      umi,
    };
  }
}

export async function mintReceiptCnft(record: ReceiptRecord) {
  const { merkleTree, umi } = await ensureReceiptTree();
  const assetOwner = record.assetOwner ?? record.buyer;
  const { signature } = await mintV2(umi, {
    leafOwner: publicKey(assetOwner),
    merkleTree: publicKey(merkleTree),
    metadata: {
      collection: none(),
      creators: [],
      name: `ShadowPilot Receipt ${record.receiptId.slice(-6).toUpperCase()}`,
      sellerFeeBasisPoints: 0,
      uri: record.metadataUrl,
    },
  }).sendAndConfirm(umi, {
    confirm: {
      commitment: "finalized",
    },
  });

  const leaf = await parseLeafFromMintV2Transaction(umi, signature);
  const encodedSignature =
    typeof signature === "string" ? signature : Buffer.from(signature).toString("hex");

  return {
    assetId: leaf.id,
    merkleTree,
    signature: encodedSignature,
  };
}
