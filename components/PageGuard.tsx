"use client";

import type { ReactNode } from "react";
import { usePageLock, type PageLockOptions } from "@/lib/hooks/usePageLock";

type Props = PageLockOptions & {
  children: ReactNode;
  fallback?: ReactNode;
};

export function PageGuard({ children, fallback = null, ...options }: Props) {
  const { isLoading, canAccess } = usePageLock(options);

  if (isLoading) return fallback;
  if (!canAccess) return null;

  return <>{children}</>;
}
