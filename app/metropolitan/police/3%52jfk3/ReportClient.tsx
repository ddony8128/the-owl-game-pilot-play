"use client";

import { useState } from "react";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ReportSubmittedScreen } from "./ReportSubmittedScreen";
import { ReportForm } from "./ReportForm";

export default function ReportClient() {
  const { nickname, isLoading } = usePlayerAuth();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (isLoading) return <LoadingScreen />;

  const handleSubmit = async () => {
    if (name.trim().length < 2 || content.trim().length < 2) {
      setError("닉네임과 내용을 2글자 이상 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/subway/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname,
          name: name.trim(),
          content: content.trim(),
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ??
            "신고 처리 중 오류가 발생했습니다. GM에게 문의해 주세요."
        );
      }

      setSubmitted(true);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "신고 처리 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <ReportSubmittedScreen nickname={nickname} />;
  }

  return (
    <ReportForm
      name={name}
      content={content}
      submitting={submitting}
      error={error}
      onChangeName={setName}
      onChangeContent={setContent}
      onSubmit={handleSubmit}
    />
  );
}
