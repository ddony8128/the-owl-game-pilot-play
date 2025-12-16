import Image from "next/image";

export default function LockedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
      <div className="mb-6 h-32 w-32 rounded-full bg-zinc-800 overflow-hidden">
        <Image
          src="/else/angry_owl.png"
          alt="angry owl"
          width={128}
          height={128}
          className="w-full h-full object-cover"
        />
      </div>
      <h1 className="mb-2 text-lg font-semibold">
        정상적이지 않은 접근이부엉!
      </h1>
    </div>
  );
}
