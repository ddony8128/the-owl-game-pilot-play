import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Image from "next/image";

type Props = {
  sunLevel: number;
  setSunLevel: Dispatch<SetStateAction<number>>;
  owlLeftWing: boolean;
  setOwlLeftWing: Dispatch<SetStateAction<boolean>>;
  owlRightWing: boolean;
  setOwlRightWing: Dispatch<SetStateAction<boolean>>;
};

export function IntroOwlScene({
  sunLevel,
  setSunLevel,
  owlLeftWing,
  setOwlLeftWing,
  owlRightWing,
  setOwlRightWing,
}: Props) {
  const [isDraggingSun, setIsDraggingSun] = useState(false);
  const sunTrackRef = useRef<HTMLDivElement | null>(null);

  const updateSunFromClientY = (clientY: number) => {
    const track = sunTrackRef.current;
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const ratio = (rect.bottom - clientY - 48) / rect.height; // 0: 맨 아래, 1: 맨 위
    const clamped = Math.min(1, Math.max(0, ratio));
    const nextLevel = Math.round(clamped * 100);
    setSunLevel(nextLevel);
  };

  const handleSunPointerDown: React.PointerEventHandler<HTMLDivElement> = (
    e
  ) => {
    e.preventDefault();
    setIsDraggingSun(true);
    updateSunFromClientY(e.clientY);
  };

  const handleSunPointerMove: React.PointerEventHandler<HTMLDivElement> = (
    e
  ) => {
    if (!isDraggingSun) return;
    updateSunFromClientY(e.clientY);
  };

  const handleSunPointerUp: React.PointerEventHandler<HTMLDivElement> = () => {
    setIsDraggingSun(false);
  };

  const toggleLeftWing = () => {
    setOwlLeftWing((v) => !v);
  };

  const toggleRightWing = () => {
    setOwlRightWing((v) => !v);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 태양 */}
      <div className="flex flex-col items-center gap-3">
        <div
          ref={sunTrackRef}
          className="relative flex h-64 w-32 items-start justify-center touch-none"
          onPointerMove={handleSunPointerMove}
          onPointerUp={handleSunPointerUp}
          onPointerLeave={handleSunPointerUp}
        >
          <div
            className="absolute left-1/2 h-24 w-24 -translate-x-1/2 cursor-pointer drop-shadow-[0_0_40px_rgba(251,191,36,0.6)]"
            style={{ bottom: `${sunLevel}%` }}
            onPointerDown={handleSunPointerDown}
          >
            <Image
              src="/hidden/sun.png"
              alt="태양"
              width={96}
              height={96}
              className="h-full w-full"
              priority
            />
          </div>
        </div>
      </div>

      {/* 부엉이 */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative flex h-40 w-48 items-center justify-center">
          <Image
            src={
              owlLeftWing && owlRightWing
                ? "/hidden/sitting_owl_both.png"
                : owlLeftWing
                ? "/hidden/sitting_owl_left.png"
                : owlRightWing
                ? "/hidden/sitting_owl_right.png"
                : "/hidden/sitting_owl.png"
            }
            alt="앉아 있는 부엉이"
            width={128}
            height={128}
            className="h-28 w-28 select-none"
            draggable={false}
            priority
          />
          {/* 왼쪽 날개 클릭 영역 */}
          <button
            type="button"
            className="absolute left-[-70%] top-1/2 h-[150%] w-[110%] -translate-y-1/2 cursor-pointer bg-transparent"
            onClick={toggleLeftWing}
            aria-label="왼쪽 날개 토글"
          />
          {/* 오른쪽 날개 클릭 영역 */}
          <button
            type="button"
            className="absolute right-[-70%] top-1/2 h-[150%] w-[110%] -translate-y-1/2 cursor-pointer bg-transparent"
            onClick={toggleRightWing}
            aria-label="오른쪽 날개 토글"
          />
        </div>
      </div>
    </div>
  );
}
