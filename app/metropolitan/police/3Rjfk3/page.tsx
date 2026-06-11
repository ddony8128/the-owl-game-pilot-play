import { redirect } from "next/navigation";

// 인쇄물/QR에 쓰인 디코드 형태(3Rjfk3)로 들어와도 동작하도록,
// 실제 라우트(3%52jfk3)로 리다이렉트한다.
export default function PoliceReportAlias() {
  redirect("/metropolitan/police/3%52jfk3");
}
