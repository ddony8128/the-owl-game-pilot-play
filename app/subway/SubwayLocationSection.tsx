import Image from "next/image";

type Props = {
  imageSrc: string | null;
  animState: "normal" | "shock1" | "shock2";
};

export function SubwayLocationSection({ imageSrc, animState }: Props) {
  return (
    <section className="flex flex-1 flex-col">
      <div
        className={`flex flex-1 items-center justify-center rounded-2xl bg-zinc-900 ${
          animState !== "normal" ? "ring-2 ring-red-500/60" : ""
        }`}
      >
        {imageSrc ? (
          <div className="relative h-full w-full aspect-square overflow-hidden rounded-2xl">
            <Image
              src={imageSrc}
              alt="지하철 장소"
              fill
              sizes="100vw"
              className="object-cover"
            />
          </div>
        ) : (
          <p className="text-sm text-zinc-400">지하통로를 지나가는 중...</p>
        )}
      </div>
    </section>
  );
}
