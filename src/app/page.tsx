export default function Page() {
  return (
    <main className="min-h-screen bg-[#020408] text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">OpsNode</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Frontend reset complete</h1>
        <p className="mt-4 text-slate-300">
          Assets are preserved. Current UI has been cleared so we can redesign from scratch with a new research-first direction.
        </p>

        <div className="mt-8 space-y-2 text-sm text-slate-300">
          <p>• /public/assets kept intact</p>
          <p>• /src/app/page.tsx reset to clean baseline</p>
          <p>• Ready for Copilot + Opus ideation pass</p>
        </div>
      </div>
    </main>
  );
}
