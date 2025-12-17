"use client";

import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SubwayEndContent } from "./SubwayEndContent";

export default function SubwayEndClient() {
  const router = useRouter();
  const { isLoading } = usePlayerAuth();

  if (isLoading) return <LoadingScreen />;

  return <SubwayEndContent onBackToIntro={() => router.replace("/intro")} />;
}
