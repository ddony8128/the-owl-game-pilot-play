import type { Metadata } from "next";
import { DefenseBoardClient } from "./DefenseBoardClient";
import { BoardVideoFromUrl } from "@/components/BoardVideoLayer";

export const metadata: Metadata = {
  title: "디펜스 딜레마 중계",
};

export default function DefenseBoardPage() {
  return (
    <>
      <DefenseBoardClient />
      {/* GM 대시보드 [룰 영상]으로 켜는 전체 화면 영상 */}
      <BoardVideoFromUrl />
    </>
  );
}
