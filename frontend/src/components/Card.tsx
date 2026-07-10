import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-edge bg-panel/70 backdrop-blur-sm shadow-lg shadow-black/30 ${className}`}
    >
      {(title || right) && (
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div>
            {title && (
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-300">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-slate-500">{subtitle}</p>
            )}
          </div>
          {right}
        </div>
      )}
      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}
