import type { Metadata } from "next";
import { SubwayBoardClient } from "./SubwayBoardClient";

export const metadata: Metadata = {
  title: "이상교통 8번출구 중계",
};

export default function SubwayBoardPage() {
  return <SubwayBoardClient />;
}
