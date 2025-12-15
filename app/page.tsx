import { redirect } from "next/navigation";

export default function Home() {
  // 메인 도메인 접속 시 인트로로 리다이렉트
  redirect("/intro");
}
