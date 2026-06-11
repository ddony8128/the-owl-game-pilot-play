import Image from "next/image";

// 1game-only: 히든피스 트리거(태양 드래그 + 날개 토글)를 제거하고
// 장식용 정적 장면으로만 표시한다. (날개 클릭영역 버튼이 컨테이너 밖으로
// 삐져나가 가로 오버플로를 만들던 문제도 함께 해결)
export function IntroOwlScene() {
  return (
    <div className="flex flex-col items-center gap-8">
      {/* 태양 */}
      <Image
        src="/hidden/sun.png"
        alt="태양"
        width={96}
        height={96}
        priority
        className="h-24 w-24 drop-shadow-[0_0_40px_rgba(251,191,36,0.6)]"
      />

      {/* 부엉이 */}
      <Image
        src="/hidden/sitting_owl.png"
        alt="앉아 있는 부엉이"
        width={128}
        height={128}
        priority
        draggable={false}
        className="h-28 w-28 select-none"
      />
    </div>
  );
}
