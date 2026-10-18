type Props = {
  roundLabel: string;
};

export function DefenseHeader({ roundLabel }: Props) {
  return (
    <header className="w-full max-w-md space-y-3 text-center">
      <div className="space-y-1">
        <p className="text-2xl font-semibold text-zinc-100">디펜스 딜레마</p>
        <p className="text-sm text-zinc-400">현재 라운드: {roundLabel}</p>
      </div>
    </header>
  );
}
