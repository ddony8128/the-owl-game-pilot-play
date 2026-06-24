import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 가이드 스크린샷 캡처(HIDE_DEV_INDICATOR=1) 시 개발용 표시기/배지를 숨긴다.
  // 평소 개발에는 영향이 없다.
  ...(process.env.HIDE_DEV_INDICATOR === "1" ? { devIndicators: false } : {}),
};

export default nextConfig;
