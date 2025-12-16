import type { Metadata } from "next";
import MafiaClient from "./MafiaClient";

export const metadata: Metadata = {
  title: "자본주의 마피아",
  description: "자본주의 마피아 페이지",
};

export default function MafiaPage() {
  return <MafiaClient />;
}
