"use client";

import { useState, type ReactNode } from "react";

type Props = { className?: string; summary: ReactNode; children: ReactNode; defaultOpen?: boolean };

/** 접힌 패널의 내용은 처음 열 때까지 마운트하지 않는다. */
export function LazyDetails({ className, summary, children, defaultOpen = false }: Props) {
  const [hasOpened, setHasOpened] = useState(defaultOpen);
  return (
    <details className={className} open={defaultOpen || undefined} onToggle={(event) => {
      if (event.currentTarget.open) setHasOpened(true);
    }}>
      <summary className="cursor-pointer">{summary}</summary>
      {hasOpened ? children : null}
    </details>
  );
}
