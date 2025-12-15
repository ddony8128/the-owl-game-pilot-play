type Props = {
  message: string;
};

export function ErrorMessage({ message }: Props) {
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
      {message}
    </div>
  );
}
