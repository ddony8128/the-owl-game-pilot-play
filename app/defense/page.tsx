import type { Metadata } from "next";
import DefenseClient from "./DefenseClient";

export const metadata: Metadata = {
  title: "디펜스 딜레마",
  description: "디펜스 딜레마 플레이 페이지",
};

export default function DefensePage() {
  return <DefenseClient />;
}


