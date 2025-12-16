import type { Dispatch, SetStateAction } from "react";

type Props = {
  sunLevel: number;
  setSunLevel: Dispatch<SetStateAction<number>>;
  owlLeftWing: boolean;
  setOwlLeftWing: Dispatch<SetStateAction<boolean>>;
  owlRightWing: boolean;
  setOwlRightWing: Dispatch<SetStateAction<boolean>>;
  onRevealHidden: () => void;
};

export function IntroOwlScene({
  sunLevel,
  setSunLevel,
  owlLeftWing,
  setOwlLeftWing,
  owlRightWing,
  setOwlRightWing,
  onRevealHidden,
}: Props) {
  const handleSunChange = (value: number) => {
    setSunLevel(value);
    if (value === 0 && owlLeftWing && owlRightWing) {
      onRevealHidden();
    }
  };

  const toggleLeftWing = () => {
    setOwlLeftWing((v) => {
      const next = !v;
      if (sunLevel === 0 && next && owlRightWing) {
        onRevealHidden();
      }
      return next;
    });
  };

  const toggleRightWing = () => {
    setOwlRightWing((v) => {
      const next = !v;
      if (sunLevel === 0 && owlLeftWing && next) {
        onRevealHidden();
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 태양 */}
      <div className="flex flex-col items-center gap-2">
        <div className="h-24 w-24 rounded-full bg-linear-to-br from-amber-300 to-amber-500 shadow-[0_0_40px_rgba(251,191,36,0.6)]" />
        <input
          type="range"
          min={0}
          max={100}
          value={sunLevel}
          onChange={(e) => handleSunChange(Number(e.target.value))}
          className="w-40"
        />
        <span className="text-xs text-zinc-400">태양 밝기: {sunLevel}</span>
      </div>

      {/* 부엉이 */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-zinc-800">
          <div
            className={`absolute left-4 top-10 h-6 w-8 cursor-pointer rounded-full bg-zinc-700 transition-transform ${
              owlLeftWing ? "-rotate-12 -translate-y-2" : "rotate-6"
            }`}
            onClick={toggleLeftWing}
          />
          <div className="h-16 w-16 rounded-full bg-zinc-600" />
          <div
            className={`absolute right-4 top-10 h-6 w-8 cursor-pointer rounded-full bg-zinc-700 transition-transform ${
              owlRightWing ? "rotate-12 -translate-y-2" : "-rotate-6"
            }`}
            onClick={toggleRightWing}
          />
        </div>
        <p className="text-xs text-zinc-400">부엉이 날개를 톡톡 눌러 보세요.</p>
      </div>
    </div>
  );
}
