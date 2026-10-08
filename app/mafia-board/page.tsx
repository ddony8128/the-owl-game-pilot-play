import type { Metadata } from "next";
import { MafiaBoardClient } from "./MafiaBoardClient";
import { BoardVideoFromUrl } from "@/components/BoardVideoLayer";

export const metadata: Metadata = {
  title: "자본주의 마피아 중계",
};

export default function MafiaBoardPage() {
  return (
    <>
      <MafiaBoardClient />
      {/* GM 대시보드 [룰 영상]으로 켜는 전체 화면 영상 */}
      <BoardVideoFromUrl />
    </>
  );
}
