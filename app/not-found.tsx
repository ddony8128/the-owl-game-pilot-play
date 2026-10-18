import { AddressNotice } from "@/components/AddressNotice";

// ITER6 C1 — 없는 주소는 /locked 로 보내지 않고 중립적인 안내 + [입장 화면으로] 를 바로 보여 준다.
export default function NotFound() {
  return <AddressNotice testId="not-found" />;
}
