import { AddressNotice } from "@/components/AddressNotice";

// 옛 링크 호환용. 참가자 화면 가드는 더 이상 이리로 보내지 않는다(ITER6 C1 — 입장 화면 또는 그 방 게임 화면으로).
export default function LockedPage() {
  return <AddressNotice testId="locked" />;
}
