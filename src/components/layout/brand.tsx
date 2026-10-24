import Link from "next/link";

/** A ledger line that ends in a dot: the product is about everything connecting. */
export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M8 21.5h11M8 16h16M8 10.5h8" stroke="var(--primary-foreground)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="23.5" cy="21.5" r="2.4" fill="var(--primary-foreground)" />
    </svg>
  );
}

export function Brand({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-control px-1 py-1">
      <BrandMark />
      <span className="text-lg font-semibold tracking-tight">LifeOS</span>
    </Link>
  );
}
