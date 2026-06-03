// 테스트 콘솔/초기화용 서버 가드.
// ENABLE_TEST_CONSOLE=1 인 배포에서만 테스트용 파괴적 API가 동작한다.
// 실제 이벤트 배포에서는 이 값을 설정하지 않아 DB가 보호된다.
export function isTestConsoleEnabled(): boolean {
  return process.env.ENABLE_TEST_CONSOLE === "1";
}

export const TEST_CONSOLE_DISABLED_MESSAGE =
  "테스트 콘솔이 비활성화되어 있습니다. (ENABLE_TEST_CONSOLE=1 필요)";
