import type { Metadata } from "next";
import ReportClient from "./ReportClient";

export const metadata: Metadata = {
  title: "부엉경찰청",
  description: "수배범 신고 페이지",
};

export default function ReportPage() {
  return <ReportClient />;
}
