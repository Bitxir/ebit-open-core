import { Link } from "@tanstack/react-router";
import mark from "@/assets/ebit-mark.png.asset.json";
import wordmark from "@/assets/ebit-wordmark.png.asset.json";

export function EbitBrand({ suffix = "Open Core" }: { suffix?: string }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="EBiT Open Core home">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-chip p-1">
        <img src={mark.url} alt="" width={28} height={28} className="h-full w-full object-contain" />
      </span>
      <span className="rounded-md bg-brand-chip px-1.5 py-0.5">
        <img src={wordmark.url} alt="ebit" width={27} height={16} className="h-4 w-auto" />
      </span>
      <span className="font-display text-sm font-semibold text-primary">
        {suffix}
      </span>
    </Link>
  );
}
