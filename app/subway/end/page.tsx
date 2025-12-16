import type { Metadata } from "next";
import SubwayEndClient from "./SubwayEndClient";

export const metadata: Metadata = {
  title: "이상교통 8번출구",
  description: "이상교통 8번출구 플레이 페이지",
};

export default function SubwayEndPage() {
  return <SubwayEndClient />;
}
