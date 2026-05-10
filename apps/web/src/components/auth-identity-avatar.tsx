import clsx from "clsx";

import { getSolanaIdenticonDataUrl } from "@/lib/solana-identicon";

function getIdentityInitial({
  address,
  name,
}: {
  address: string | null;
  name: string | null;
}) {
  const source = name?.trim() || address || "S";
  return source.charAt(0).toUpperCase();
}

export function AuthIdentityAvatar({
  address,
  imageUrl,
  name,
  size = "md",
}: {
  address: string | null;
  imageUrl: string | null;
  name: string | null;
  size?: "md" | "sm";
}) {
  const generatedImageUrl = getSolanaIdenticonDataUrl(address);
  const avatarImageUrl = generatedImageUrl ?? imageUrl;

  return (
    <div
      aria-hidden="true"
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--background-muted)] font-semibold text-[var(--text)]",
        size === "sm" ? "h-10 w-10 text-sm" : "h-11 w-11 text-sm",
        avatarImageUrl ? "bg-center bg-no-repeat" : "",
        generatedImageUrl ? "bg-white" : "",
      )}
      style={
        avatarImageUrl
          ? {
              backgroundImage: `url("${avatarImageUrl}")`,
              backgroundSize: generatedImageUrl ? "74%" : "cover",
            }
          : undefined
      }
    >
      {avatarImageUrl ? null : getIdentityInitial({ address, name })}
    </div>
  );
}
