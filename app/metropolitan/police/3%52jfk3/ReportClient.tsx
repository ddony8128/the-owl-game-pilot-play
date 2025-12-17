"use client";

import { useEffect, useState } from "react";
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
  const [reportId, setReportId] = useState<number | null>(null);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">(
    "pending"
  );

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
        id?: number;
        status?: "pending" | "approved" | "rejected" | string;
        error?: string;
      } | null;

      if (!res.ok || !json?.ok || typeof json.id !== "number") {
        throw new Error(
          json?.error ??
            "신고 처리 중 오류가 발생했습니다. GM에게 문의해 주세요."
        );
      }

      setReportId(json.id);
      setStatus(
        json.status === "approved" || json.status === "rejected"
          ? json.status
          : "pending"
      );
      setSubmitted(true);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "신고 처리 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (!submitted || reportId == null) return;
      try {
        const res = await fetch(`/api/subway/report?id=${reportId}`);
        const json = (await res.json().catch(() => null)) as {
          report?: { id: number | string; status: string };
          error?: string;
        } | null;
        if (!res.ok || !json || "error" in json) {
          return;
        }
        const s = json.report?.status ?? "pending";
        if (s === "approved" || s === "rejected") {
          if (!cancelled) {
            setStatus(s);
          }
        }
      } catch {
        // 폴링 실패는 조용히 무시
      }
    };

    const interval = setInterval(() => {
      void poll();
    }, 2000);

    // 처음 한 번 즉시 호출
    void poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [submitted, reportId]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (submitted) {
    return (
      <ReportSubmittedScreen
        status={status}
        onBack={() => {
          setSubmitted(false);
          setReportId(null);
          setStatus("pending");
        }}
      />
    );
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
