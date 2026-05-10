import { readReceiptRecord } from "@/lib/server/shadowpilot-storage";

export const runtime = "nodejs";

function escapeSvg(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function compactAddress(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-8)}` : value;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ receiptId: string }> },
) {
  try {
    const { receiptId } = await context.params;
    const record = await readReceiptRecord(receiptId);
    const payoutSol = (Number(record.payoutLamports) / 1_000_000_000).toFixed(2);
    const rightsHolder = record.assetOwner ?? record.buyer;
    const svg = `
      <svg width="1200" height="628" viewBox="0 0 1200 628" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="628" rx="32" fill="#F7F8FA"/>
        <rect x="24" y="24" width="1152" height="580" rx="28" fill="#FFFFFF" stroke="#E5E7EB"/>
        <rect x="60" y="60" width="190" height="40" rx="20" fill="#F3F4F6"/>
        <text x="92" y="86" fill="#111827" font-size="18" font-family="Inter, Arial, sans-serif" font-weight="700">ShadowPilot</text>
        <text x="60" y="158" fill="#6B7280" font-size="18" font-family="Inter, Arial, sans-serif" font-weight="600">Compressed receipt</text>
        <text x="60" y="222" fill="#111827" font-size="46" font-family="Inter, Arial, sans-serif" font-weight="700">${escapeSvg(record.taskTitle)}</text>
        <text x="60" y="266" fill="#4B5563" font-size="24" font-family="Inter, Arial, sans-serif">${escapeSvg(record.environment)}</text>
        <rect x="60" y="322" width="238" height="126" rx="22" fill="#F9FAFB" stroke="#E5E7EB"/>
        <text x="84" y="360" fill="#6B7280" font-size="16" font-family="Inter, Arial, sans-serif" font-weight="600">Buyer score</text>
        <text x="84" y="418" fill="#111827" font-size="52" font-family="Inter, Arial, sans-serif" font-weight="700">${record.score}/100</text>
        <rect x="326" y="322" width="238" height="126" rx="22" fill="#F9FAFB" stroke="#E5E7EB"/>
        <text x="350" y="360" fill="#6B7280" font-size="16" font-family="Inter, Arial, sans-serif" font-weight="600">Payout</text>
        <text x="350" y="418" fill="#111827" font-size="52" font-family="Inter, Arial, sans-serif" font-weight="700">${payoutSol} SOL</text>
        <rect x="592" y="322" width="548" height="126" rx="22" fill="#F9FAFB" stroke="#E5E7EB"/>
        <text x="616" y="360" fill="#6B7280" font-size="16" font-family="Inter, Arial, sans-serif" font-weight="600">Usage rights</text>
        <text x="616" y="418" fill="#111827" font-size="32" font-family="Inter, Arial, sans-serif" font-weight="700">${escapeSvg(record.usageRights)}</text>
        <text x="60" y="532" fill="#6B7280" font-size="16" font-family="Inter, Arial, sans-serif" font-weight="600">Receipt ID</text>
        <text x="60" y="566" fill="#111827" font-size="22" font-family="Inter, Arial, sans-serif">${escapeSvg(receiptId)}</text>
        <text x="592" y="532" fill="#6B7280" font-size="16" font-family="Inter, Arial, sans-serif" font-weight="600">Rights holder</text>
        <text x="592" y="566" fill="#111827" font-size="22" font-family="Inter, Arial, sans-serif">${escapeSvg(compactAddress(rightsHolder))}</text>
      </svg>
    `.trim();

    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml",
      },
      status: 200,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Receipt artwork not found.",
      },
      { status: 404 },
    );
  }
}
