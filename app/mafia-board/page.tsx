import type { Metadata } from "next";
import { MafiaBoardClient } from "./MafiaBoardClient";

export const metadata: Metadata = {
  title: "자본주의 마피아 중계",
};

export default function MafiaBoardPage() {
  return <MafiaBoardClient />;
}
