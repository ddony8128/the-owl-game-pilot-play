import { notFound } from "next/navigation";

// 1game-only 브랜치: 1인 다역 테스트 콘솔은 사용하지 않는다.
// 플레이어 등록/삭제·초기화는 GM 대시보드(/dashboard/x9a2k7/main)로 일원화됨.
// 접근 자체를 막기 위해 항상 404 처리한다.
export default function TestConsolePage() {
  notFound();
}
