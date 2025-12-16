import type { Metadata } from "next";
import QuizShowClient from "./QuizShowClient";

export const metadata: Metadata = {
  title: "부엉퀴즈쇼",
  description: "부엉퀴즈쇼 페이지",
};

export default function QuizShowPage() {
  return <QuizShowClient />;
}
