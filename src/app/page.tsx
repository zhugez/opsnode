"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Brain,
  Shield,
  Zap,
  Radar,
  Users,
  Clock3,
  Play,
  Pause,
  Settings,
  Sparkles,
} from "lucide-react";

type UnitStatus = "running" | "idle" | "paused";
type UnitRole = "Sentinel" | "Sniper" | "Analyst" | "Medic";

type Unit = {
  id: string;
  name: string;
  callsign: string;
  role: UnitRole;
  squad: "Alpha" | "Bravo" | "Charlie";
  status: UnitStatus;
  model: string;
  latencyMs: number;
  load: number;
};

const seedUnits: Unit[] = [
  { id: "u1", name: "Yasna", callsign: "ORBIT", role: "Analyst", squad: "Alpha", status: "running", model: "gpt-5.3-codex", latencyMs: 182, load: 64 },
  { id: "u2", name: "Vanguard", callsign: "AEGIS", role: "Sentinel", squad: "Alpha", status: "idle", model: "gemini-3-pro", latencyMs: 225, load: 38 },
  { id: "u3", name: "Longshot", callsign: "PINPOINT", role: "Sniper", squad: "Bravo", status: "running", model: "gpt-5.3-codex", latencyMs: 201, load: 71 },
  { id: "u4", name: "Lifeline", callsign: "AURORA", role: "Medic", squad: "Charlie", status: "paused", model: "gemini-3-pro", latencyMs: 265, load: 44 },
  { id: "u5", name: "Nexus", callsign: "SPECTRA", role: "Analyst", squad: "Bravo", status: "running", model: "gpt-5.3-codex", latencyMs: 176, load: 58 },
  { id: "u6", name: "Remedy", callsign: "PATCH", role: "Medic", squad: "Charlie", status: "idle", model: "gpt-5.3-codex", latencyMs: 214, load: 29 },
];

const squadTone: Record<Unit["squad"], string> = {
  Alpha: "#7dd3c0",
  Bravo: "#2d5da1",
  Charlie: "#f4a261",
};

const statusTone: Record<UnitStatus, string> = {
  running: "text-emerald-300",
  idle: "text-slate-300",
  paused: "text-amber-300",
};

export default function Page() {
  const [units, setUnits] = useState<Unit[]>(seedUnits);
  const [selected, setSelected] = useState<string>(seedUnits[0].id);

  const selectedUnit = useMemo(() => units.find((u) => u.id === selected) ?? units[0], [selected, units]);

  const stats = useMemo(() => {
    const running = units.filter((u) => u.status === "running").length;
    const paused = units.filter((u) => u.status === "paused").length;
    const avgLatency = Math.round(units.reduce((s, u) => s + u.latencyMs, 0) / units.length);
    const avgLoad = Math.round(units.reduce((s, u) => s + u.load, 0) / units.length);
    return { running, paused, avgLatency, avgLoad };
  }, [units]);

  const toggleStatus = (id: string) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        if (u.status === "running") return { ...u, status: "paused" };
        if (u.status === "paused") return { ...u, status: "idle" };
        return { ...u, status: "running" };
      }),
    );
  };

  return (
    <main className="min-h-screen bg-[#020408] text-slate-100 selection:bg-cyan-500/30">
      <div className="mx-auto max-w-[1480px] px-4 py-8 md:px-8 md:py-10">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel relative overflow-hidden rounded-[28px] p-6 md:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,192,0.18),transparent_50%),radial-gradient(circle_at_80%_10%,rgba(244,162,97,0.14),transparent_48%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">OpsNode Command Fabric</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">Luxury Tactical Grid</h1>
              <p className="mt-3 max-w-xl text-sm text-slate-300/90">
                New visual DNA blended from VoxYZ + Ralv: glass depth, neon traces, and calm high-tech control.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <Metric label="Live Units" value={`${units.length}`} icon={<Users className="h-4 w-4" />} />
              <Metric label="Running" value={`${stats.running}`} icon={<Play className="h-4 w-4" />} />
              <Metric label="Latency" value={`${stats.avgLatency}ms`} icon={<Clock3 className="h-4 w-4" />} />
              <Metric label="Avg Load" value={`${stats.avgLoad}%`} icon={<Activity className="h-4 w-4" />} />
            </div>
          </div>
        </motion.header>

        <section className="mt-6 grid gap-6 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-panel lg:col-span-8 rounded-[24px] p-5 md:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">
                <Radar className="h-4 w-4" /> Tactical Stage
              </h2>
              <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Reforged UI
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {units.map((u) => {
                const active = selected === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelected(u.id)}
                    className={`group rounded-2xl border p-4 text-left transition-all duration-300 ${
                      active
                        ? "border-white/30 bg-white/10 shadow-[0_0_30px_rgba(45,93,161,0.35)]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">[{u.callsign}] {u.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{u.role} · Squad {u.squad}</p>
                      </div>
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: squadTone[u.squad], boxShadow: `0 0 14px ${squadTone[u.squad]}` }}
                      />
                    </div>

                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Status</span>
                        <span className={`font-semibold uppercase ${statusTone[u.status]}`}>{u.status}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Model</span>
                        <span className="font-medium text-slate-200">{u.model}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${u.load}%`,
                            background: `linear-gradient(90deg, ${squadTone[u.squad]}, #e8e6f0)`,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-panel lg:col-span-4 rounded-[24px] p-5 md:p-6"
          >
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-amber-200">
              <Sparkles className="h-4 w-4" /> Unit Focus
            </h2>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Selected</p>
              <p className="mt-2 text-lg font-extrabold">[{selectedUnit.callsign}] {selectedUnit.name}</p>
              <p className="text-sm text-slate-400">{selectedUnit.role} · Squad {selectedUnit.squad}</p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <Pill icon={<Brain className="h-3.5 w-3.5" />} text={selectedUnit.model} />
                <Pill icon={<Clock3 className="h-3.5 w-3.5" />} text={`${selectedUnit.latencyMs}ms`} />
                <Pill icon={<Shield className="h-3.5 w-3.5" />} text={`Load ${selectedUnit.load}%`} />
                <Pill icon={<Zap className="h-3.5 w-3.5" />} text={selectedUnit.status.toUpperCase()} />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => toggleStatus(selectedUnit.id)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-100 hover:bg-cyan-400/20"
                >
                  {selectedUnit.status === "running" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  Cycle Status
                </button>
                <button className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-slate-300 hover:bg-white/10">
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">System Notes</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>• Squad colors remapped to Ralv/VoxYZ hybrid palette.</li>
                <li>• Surface contrast tuned for premium low-light dashboard.</li>
                <li>• Motion kept subtle for tactical readability.</li>
              </ul>
            </div>
          </motion.aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold leading-none text-slate-100">{value}</p>
    </div>
  );
}

function Pill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-slate-200">
      {icon}
      <span className="truncate">{text}</span>
    </div>
  );
}
