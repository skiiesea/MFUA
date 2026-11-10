import clsx from 'clsx';

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="vsp-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--c-accent))" />
          <stop offset="1" stopColor="rgb(var(--c-accent2))" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="rgb(var(--c-raised))" />
      <path d="M32 10c1.6 10.6 6.4 15.4 17 17-10.6 1.6-15.4 6.4-17 17-1.6-10.6-6.4-15.4-17-17 10.6-1.6 15.4-6.4 17-17z" fill="url(#vsp-g)" />
      <circle cx="46" cy="47" r="4" fill="url(#vsp-g)" />
    </svg>
  );
}

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span className={clsx('inline-flex items-center gap-3', className)}>
      <LogoMark size={size} />
      <span className="font-display text-xl font-semibold tracking-tight">Vesper</span>
    </span>
  );
}
