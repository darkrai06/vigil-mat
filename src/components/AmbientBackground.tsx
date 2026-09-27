export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute -top-40 -left-32 size-[520px] rounded-full bg-brand/15 blur-[120px]" />
      <div className="absolute top-1/3 -right-40 size-[460px] rounded-full bg-correct/10 blur-[120px]" />
      <div className="absolute bottom-0 left-1/3 size-[420px] rounded-full bg-amber/10 blur-[120px]" />
    </div>
  );
}
