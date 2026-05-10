import { minidenticon } from "minidenticons";

export function getSolanaIdenticonDataUrl(address: string | null) {
  const seed = address?.trim();
  if (!seed) {
    return null;
  }

  const svg = minidenticon(seed, 88, 48);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
