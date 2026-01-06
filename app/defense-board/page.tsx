import type { Metadata } from "next";
import { DefenseBoardClient } from "./DefenseBoardClient";

export const metadata: Metadata = {
  title: "디펜스 딜레마 중계",
};

export default function DefenseBoardPage() {
  return <DefenseBoardClient />;
}
