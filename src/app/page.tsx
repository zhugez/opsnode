"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sphere, MeshDistortMaterial, Float, Line } from "@react-three/drei";
import { motion } from "framer-motion";
import {
  Activity,
  Brain,
  CheckCircle2,
  Clock3,
  Plus,
  Save,
  Settings,
  Trash2,
  RotateCcw,
  Pause,
  Play,
  Power,
  Sparkles,
  Radar,
} from "lucide-react";

type BotConfig = {
  id: string;
  name: string;
  status: "idle" | "running" | "paused";
  priority: "low" | "med" | "high";
  enabled: boolean;
  model: string;
  provider: "openai-codex" | "google-gemini-cli";
  thinking: "low" | "medium" | "high";
  allowedTools: string;
  schedule: string;
  channel: string;
  lastRun: string;
};

type ConfigVersion = {
  at: string;
  bots: BotConfig[];
};

const STORAGE_KEY = "opsnode.bots.v1";
const VERSIONS_KEY = "opsnode.bots.versions.v1";

const defaults: BotConfig[] = [
  {
    id: "yasna-main",
    name: "Yasna",
    status: "idle",
    priority: "high",
    enabled: true,
    model: "gpt-5.3-codex",
    provider: "openai-codex",
    thinking: "low",
    allowedTools: "exec, browser, cron, memory_search",
    schedule: "manual",
    channel: "telegram",
    lastRun: "-",
  },
  {
    id: "zhu-ops",
    name: "Zhu",
    status: "idle",
    priority: "med",
    enabled: true,
    model: "gemini-3-pro-preview",
    provider: "google-gemini-cli",
    thinking: "medium",
    allowedTools: "exec, web_search, message",
    schedule: "daily",
    channel: "telegram",
    lastRun: "-",
  },
];

function NodeCore() {
  const points: [number, number, number][] = [
    [-1.9, 0.9, -0.8],
    [-0.9, 0.25, 0.45],
    [0, 0, 0],
    [0.95, -0.3, -0.45],
    [1.85, 0.8, 0.75],
  ];

  return (
    <>
      <ambientLight intensity={0.42} />
      <pointLight position={[2.4, 2.1, 2.5]} intensity={1.1} color="#6fe8ff" />
      <pointLight position={[-2.1, -1.2, 1.2]} intensity={0.65} color="#4b63ff" />
      <Float speed={0.95} rotationIntensity={0.25} floatIntensity={0.48}>
        <Sphere args={[1.06, 64, 64]}>
          <MeshDistortMaterial
            color="#78d9ff"
            emissive="#17485f"
            emissiveIntensity={0.65}
            roughness={0.14}
            metalness={0.38}
            distort={0.17}
            speed={1.35}
          />
        </Sphere>
      </Float>
      <Float speed={0.7} rotationIntensity={0.2} floatIntensity={0.35}>
        <mesh rotation={[Math.PI / 2.15, 0, 0]}>
          <torusGeometry args={[1.62, 0.014, 20, 160]} />
          <meshStandardMaterial color="#82dfff" emissive="#1d3f5e" emissiveIntensity={0.55} />
        </mesh>
      </Float>
      <Line points={points} color="#8fcbff" lineWidth={1} transparent opacity={0.52} />
      <Line points={[points[0], points[2], points[4]]} color="#c5eaff" lineWidth={0.7} transparent opacity={0.35} />
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[i === 2 ? 0.07 : 0.05, 16, 16]} />
          <meshStandardMaterial color="#dff4ff" emissive="#7cdcff" emissiveIntensity={0.7} />
        </mesh>
      ))}
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.42} />
    </>
  );
}

function loadBots(): BotConfig[] {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<BotConfig>[]) : defaults;
    return parsed.map((b, i) => ({
      ...defaults[Math.min(i, defaults.length - 1)],
      ...b,
      priority: (b.priority as BotConfig["priority"]) || "med",
    })) as BotConfig[];
  } catch {
    return defaults;
  }
}

function saveSnapshot(bots: BotConfig[]) {
  if (typeof window === "undefined") return;
  const prevRaw = localStorage.getItem(VERSIONS_KEY);
  const prev: ConfigVersion[] = prevRaw ? JSON.parse(prevRaw) : [];
  const next = [{ at: new Date().toISOString(), bots }, ...prev].slice(0, 20);
  localStorage.setItem(VERSIONS_KEY, JSON.stringify(next));
}

export default function Page() {
  const [bots, setBots] = useState<BotConfig[]>(defaults);
  const [selectedId, setSelectedId] = useState<string>(defaults[0].id);
  const [viewMode, setViewMode] = useState<"commander" | "detail">("commander");
  const [showConfig, setShowConfig] = useState(false);
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [gatewayMsg, setGatewayMsg] = useState<string>("");

  useEffect(() => setBots(loadBots()), []);

  const selected = useMemo(() => bots.find((b) => b.id === selectedId) || bots[0], [bots, selectedId]);
  const selectedCount = selectedBots.length;

  const selectedBotUnits = useMemo(() => bots.filter((b) => selectedBots.includes(b.id)), [bots, selectedBots]);

  const tacticalCells = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const row = Math.floor(i / 6);
      const col = i % 6;
      const active = i % 5 === 0 || i === 7 || i === 18;
      const focused = selectedCount > 0 && i < selectedCount;
      const linked = focused ? selectedBotUnits[i] : undefined;

      return {
        id: i,
        row,
        col,
        active,
        focused,
        linked,
      };
    });
  }, [selectedCount, selectedBotUnits]);

  const persist = (next: BotConfig[]) => {
    setBots(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const addBot = () => {
    const id = `bot-${Date.now()}`;
    const next: BotConfig[] = [
      ...bots,
      {
        id,
        name: `Bot ${bots.length + 1}`,
        status: "idle",
        priority: "low",
        enabled: true,
        model: "gpt-5.3-codex",
        provider: "openai-codex",
        thinking: "low",
        allowedTools: "exec, web_search",
        schedule: "manual",
        channel: "telegram",
        lastRun: "-",
      },
    ];
    saveSnapshot(bots);
    persist(next);
    setSelectedId(id);
  };

  const updateBot = (patch: Partial<BotConfig>) => {
    if (!selected) return;
    const next = bots.map((b) => (b.id === selected.id ? { ...b, ...patch } : b));
    persist(next);
  };

  const deleteBot = (id: string) => {
    const old = [...bots];
    const next = bots.filter((b) => b.id !== id);
    if (!next.length) return;
    saveSnapshot(old);
    persist(next);
    setSelectedBots((prev) => prev.filter((x) => x !== id));
    if (selectedId === id) setSelectedId(next[0].id);
  };

  const rollback = () => {
    const raw = localStorage.getItem(VERSIONS_KEY);
    const versions: ConfigVersion[] = raw ? JSON.parse(raw) : [];
    if (!versions.length) return;
    const [latest, ...rest] = versions;
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(rest));
    persist(latest.bots);
    if (!latest.bots.some((b) => b.id === selectedId) && latest.bots[0]) {
      setSelectedId(latest.bots[0].id);
    }
    setSelectedBots((prev) => prev.filter((id) => latest.bots.some((b) => b.id === id)));
  };

  const toggleBotSelection = (id: string) => {
    setSelectedBots((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const applyBatchAction = (action: "enable" | "disable" | "pause" | "resume") => {
    if (!selectedBots.length) return;
    const next = bots.map((b) => {
      if (!selectedBots.includes(b.id)) return b;
      if (action === "enable") return { ...b, enabled: true };
      if (action === "disable") return { ...b, enabled: false };
      if (action === "pause") return { ...b, status: "paused" as const };
      return { ...b, status: "running" as const };
    });
    persist(next);
    setGatewayMsg(`Batch action applied: ${action} (${selectedBots.length} bots)`);
  };

  const sendGatewayAction = async (action: "summon" | "reset") => {
    setGatewayMsg("Sending...");
    try {
      const res = await fetch("/api/gateway-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, bots }),
      });
      const json = await res.json();
      setGatewayMsg(json.message || "done");
    } catch {
      setGatewayMsg("Gateway call failed");
    }
  };

  const health = Math.round((bots.filter((b) => b.enabled).length / Math.max(1, bots.length)) * 100);

  const panelShell =
    "relative overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/55 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_26px_58px_-44px_rgba(34,211,238,0.65)]";
  const modeButton =
    "rounded-lg px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] transition duration-200";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#04070f] px-4 py-6 font-sans text-slate-100 md:px-8 md:py-10 xl:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-[-12%] h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-[125px]" />
        <div className="absolute -right-24 top-[16%] h-[380px] w-[380px] rounded-full bg-indigo-500/10 blur-[125px]" />
        <div className="absolute bottom-[-20%] left-[18%] h-[310px] w-[310px] rounded-full bg-sky-300/6 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(20,30,52,0.84)_0%,rgba(7,11,21,0.93)_54%,rgba(3,5,12,1)_100%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.04)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-12">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${panelShell} lg:col-span-8 p-5 md:p-7`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(56,189,248,0.08)_0%,transparent_42%,rgba(99,102,241,0.06)_100%)]" />
          <div className="relative">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.34em] text-cyan-200/55">OpsNode Directive Array</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Command Cockpit</h1>
                <p className="mt-2 text-sm text-slate-300/80">Dark minimal control surface for bot orchestration</p>
              </div>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-400/8 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-200">
                Live
              </span>
            </div>

            <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <button
                onClick={() => setViewMode("commander")}
                className={`${modeButton} ${
                  viewMode === "commander"
                    ? "bg-cyan-300/90 text-slate-950 shadow-[0_0_24px_-12px_rgba(103,232,249,0.9)]"
                    : "text-slate-300 hover:bg-white/8 hover:text-white"
                }`}
              >
                Commander
              </button>
              <button
                onClick={() => setViewMode("detail")}
                className={`${modeButton} ${
                  viewMode === "detail"
                    ? "bg-cyan-300/90 text-slate-950 shadow-[0_0_24px_-12px_rgba(103,232,249,0.9)]"
                    : "text-slate-300 hover:bg-white/8 hover:text-white"
                }`}
              >
                Detail
              </button>
            </div>

            <div className="relative h-[360px] overflow-hidden rounded-2xl border border-cyan-100/12 bg-[radial-gradient(circle_at_50%_20%,rgba(14,116,144,0.26)_0%,rgba(2,6,23,0.74)_56%,rgba(2,6,23,0.96)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_60px_-44px_rgba(34,211,238,0.7)]">
              <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(to_right,rgba(125,211,252,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(125,211,252,0.04)_1px,transparent_1px)] [background-size:42px_42px]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_34%,rgba(2,6,23,0.72)_100%)]" />

              <motion.div
                className="pointer-events-none absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-cyan-200/8 to-transparent"
                initial={{ x: -130, opacity: 0 }}
                animate={{ x: 760, opacity: [0, 0.35, 0] }}
                transition={{ duration: 5.6, repeat: Infinity, ease: "linear" }}
              />

              <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
                <motion.span
                  key={selectedCount}
                  initial={{ scale: 0.9, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-200/25 bg-slate-950/65 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/85"
                >
                  <Radar size={12} /> {selectedCount} selected
                </motion.span>
                {selectedCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/25 bg-violet-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-violet-100">
                    <Sparkles size={11} /> Formation synced
                  </span>
                )}
              </div>

              <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between gap-4 rounded-lg border border-cyan-100/10 bg-slate-950/45 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-cyan-100/75">
                <span>3D Engagement Layer</span>
                <span>{selectedCount > 0 ? `${selectedCount} units batch-linked` : "Select units for grouped orders"}</span>
              </div>

              <Canvas camera={{ position: [0, 0, 4.2], fov: 55 }}>
                <NodeCore />
              </Canvas>
            </div>

            {viewMode === "commander" ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em] text-cyan-200/65">Tactical Map</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">Sector Sweep · 24 Nodes</p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <i className="h-1.5 w-1.5 rounded-full bg-cyan-100 shadow-[0_0_8px_1px_rgba(103,232,249,0.55)]" /> Active
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <i className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_8px_1px_rgba(196,181,253,0.6)]" /> Assigned
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {tacticalCells.map((cell) => (
                    <motion.div
                      key={cell.id}
                      animate={
                        cell.focused
                          ? { boxShadow: ["0 0 0 rgba(196,181,253,0)", "0 0 14px rgba(196,181,253,0.28)", "0 0 0 rgba(196,181,253,0)"] }
                          : undefined
                      }
                      transition={{ duration: 2.4, repeat: Infinity }}
                      className={`relative h-9 overflow-hidden rounded-md border ${
                        cell.focused
                          ? "border-violet-300/35 bg-gradient-to-br from-violet-400/14 via-slate-950/65 to-cyan-500/10"
                          : "border-cyan-100/10 bg-gradient-to-br from-cyan-400/8 via-slate-950/65 to-blue-500/8"
                      }`}
                    >
                      <div
                        className={`absolute inset-0 bg-[radial-gradient(circle_at_28%_38%,rgba(125,211,252,0.45)_0%,transparent_64%)] ${
                          cell.active ? "opacity-85" : "opacity-20"
                        }`}
                      />
                      <div
                        className={`absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${
                          cell.focused
                            ? "bg-violet-200 shadow-[0_0_10px_1px_rgba(196,181,253,0.65)]"
                            : cell.active
                              ? "bg-cyan-100 shadow-[0_0_10px_1px_rgba(103,232,249,0.65)]"
                              : "bg-cyan-900/70"
                        }`}
                      />
                      <p className="absolute right-1.5 top-1 text-[9px] font-medium tracking-[0.14em] text-cyan-100/75">
                        {String.fromCharCode(65 + cell.row)}{cell.col + 1}
                      </p>
                      {cell.linked && (
                        <p className="absolute bottom-1 left-1.5 truncate text-[9px] font-semibold tracking-[0.1em] text-violet-100">
                          {cell.linked.name}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl sm:grid-cols-2">
                <div className="rounded-xl border border-cyan-100/10 bg-slate-950/55 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/65">Selected Unit</p>
                  <p className="mt-2 text-xl font-semibold text-white">{selected?.name || "-"}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {selected?.provider} · {selected?.model}
                  </p>
                </div>
                <div className="grid gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-cyan-100/10 bg-slate-950/55 px-3 py-2.5 text-xs text-slate-200">
                    <CheckCircle2 size={14} className="text-emerald-300" />
                    Control plane integrity: {health}%
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-cyan-100/10 bg-slate-950/55 px-3 py-2.5 text-xs text-slate-200">
                    <Clock3 size={14} className="text-cyan-200" />
                    Last event: {selected?.lastRun || "-"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        <section className="grid gap-4 lg:col-span-4">
          <Card title="Bots" value={`${bots.length}`} sub={`${bots.filter((b) => b.enabled).length} enabled`} />
          <Card title="Health" value={`${health}%`} sub="Control plane availability" />
          <Card title="Mode" value="Phase 2" sub="Bot manager + config drawer" />
          <Card title="Gateway" value="Bound" sub="/api/gateway-action wired" />
        </section>

        <section className={`${panelShell} lg:col-span-8 p-5 md:p-6`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(56,189,248,0.06)_0%,transparent_45%,rgba(99,102,241,0.05)_100%)]" />
          <div className="relative">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-white">Bot Manager</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={addBot}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/35 bg-gradient-to-r from-cyan-300 to-sky-300 px-3.5 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_20px_-12px_rgba(103,232,249,0.85)] transition hover:brightness-110"
                >
                  <Plus size={14} /> Add Bot
                </button>
                <button
                  onClick={rollback}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900/50 px-3.5 py-2 text-sm text-slate-200 transition hover:border-cyan-200/30 hover:bg-cyan-300/8"
                >
                  <RotateCcw size={14} /> Rollback
                </button>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-900/38 p-2 text-xs">
              <motion.span
                key={selectedCount}
                initial={{ scale: 0.9, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-lg border border-cyan-200/20 bg-cyan-400/8 px-2 py-1 text-cyan-100"
              >
                Selected: {selectedCount}
              </motion.span>
              <BatchButton disabled={!selectedCount} onClick={() => applyBatchAction("enable")} tone="emerald">
                Enable
              </BatchButton>
              <BatchButton disabled={!selectedCount} onClick={() => applyBatchAction("disable")} tone="rose">
                Disable
              </BatchButton>
              <BatchButton disabled={!selectedCount} onClick={() => applyBatchAction("pause")} tone="amber">
                Pause
              </BatchButton>
              <BatchButton disabled={!selectedCount} onClick={() => applyBatchAction("resume")} tone="cyan">
                Resume
              </BatchButton>
              <button
                onClick={() => setSelectedBots([])}
                disabled={!selectedCount}
                className="rounded-lg border border-white/18 px-2 py-1 text-slate-300 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Clear
              </button>
              <p className="ml-auto pr-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                {selectedCount > 0 ? "Batch command armed" : "Select bots to unlock batch actions"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {bots.map((b) => {
                const batchSelected = selectedBots.includes(b.id);

                return (
                  <motion.div
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.18 }}
                    key={b.id}
                    className={`rounded-2xl border p-4 backdrop-blur-xl transition ${
                      selectedId === b.id
                        ? "border-cyan-200/35 bg-gradient-to-br from-cyan-400/10 via-slate-900/72 to-indigo-500/10 shadow-[0_0_26px_-16px_rgba(34,211,238,0.7)]"
                        : "border-white/10 bg-slate-950/50 hover:border-cyan-100/25 hover:bg-slate-900/70"
                    } ${batchSelected ? "ring-1 ring-violet-300/35" : ""}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={batchSelected}
                          onChange={() => toggleBotSelection(b.id)}
                          className="h-4 w-4 rounded border-cyan-200/35 bg-slate-900 text-cyan-300"
                        />
                        <button className="text-left" onClick={() => setSelectedId(b.id)}>
                          <p className="text-base font-semibold text-white">{b.name}</p>
                          <p className="mt-0.5 text-xs text-slate-300">
                            {b.provider} · {b.model}
                          </p>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {batchSelected && (
                          <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-violet-100">
                            grouped
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                            b.priority === "high"
                              ? "border border-rose-300/20 bg-rose-500/16 text-rose-200"
                              : b.priority === "med"
                                ? "border border-amber-300/20 bg-amber-500/16 text-amber-200"
                                : "border border-emerald-300/20 bg-emerald-500/16 text-emerald-200"
                          }`}
                        >
                          {b.priority}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                            b.status === "running"
                              ? "border border-emerald-300/20 bg-emerald-500/16 text-emerald-200"
                              : b.status === "paused"
                                ? "border border-amber-300/20 bg-amber-500/16 text-amber-200"
                                : "border border-slate-300/20 bg-slate-500/25 text-slate-200"
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setSelectedId(b.id);
                          setShowConfig(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-100/18 bg-slate-900/45 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-cyan-200/35 hover:bg-cyan-300/8"
                      >
                        <Settings size={13} /> Config
                      </button>
                      <button
                        onClick={() => {
                          const next: BotConfig[] = bots.map((x) =>
                            x.id === b.id
                              ? { ...x, status: (x.status === "paused" ? "running" : "paused") as BotConfig["status"] }
                              : x,
                          );
                          persist(next);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-100/18 bg-slate-900/45 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-cyan-200/35 hover:bg-cyan-300/8"
                      >
                        {b.status === "paused" ? <Play size={13} /> : <Pause size={13} />}
                        {b.status === "paused" ? "Resume" : "Pause"}
                      </button>
                      <button
                        onClick={() => {
                          const next = bots.map((x) => (x.id === b.id ? { ...x, enabled: !x.enabled } : x));
                          persist(next);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-100/18 bg-slate-900/45 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-cyan-200/35 hover:bg-cyan-300/8"
                      >
                        <Power size={13} /> {b.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => deleteBot(b.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-300/20 bg-rose-500/5 px-2.5 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/12"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section className={`${panelShell} lg:col-span-4 p-5 md:p-6`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(56,189,248,0.07)_0%,transparent_36%,rgba(99,102,241,0.08)_100%)]" />
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Quick Actions</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">Gateway Dispatch</p>
            <div className="mt-5 space-y-3">
              <button
                onClick={() => sendGatewayAction("summon")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/35 bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-2.5 font-medium text-slate-950 shadow-[0_0_20px_-12px_rgba(103,232,249,0.85)] transition hover:brightness-110"
              >
                <Activity size={16} /> Summon All
              </button>
              <button
                onClick={() => sendGatewayAction("reset")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-100/20 bg-slate-900/58 px-4 py-2.5 text-cyan-100 transition hover:border-cyan-200/32 hover:bg-cyan-300/8"
              >
                <Brain size={16} /> Reset Context
              </button>
              <button
                onClick={() => setShowConfig(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-900/55 px-4 py-2.5 text-slate-100 transition hover:border-white/30 hover:bg-white/8"
              >
                <Settings size={16} /> Open Config Drawer
              </button>
            </div>
            <p className="mt-4 rounded-lg border border-cyan-100/10 bg-slate-900/55 px-3 py-2 text-xs text-slate-300">
              {gatewayMsg || "Gateway ready"}
            </p>
          </div>
        </section>
      </div>

      {showConfig && selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-4 backdrop-blur-sm md:items-center">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/12 bg-slate-950/90 p-5 shadow-[0_24px_80px_-40px_rgba(34,211,238,0.68)] backdrop-blur-2xl md:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(56,189,248,0.07)_0%,transparent_42%,rgba(99,102,241,0.08)_100%)]" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-semibold tracking-tight text-white">Config · {selected.name}</h3>
                <button
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/8 hover:text-white"
                  onClick={() => setShowConfig(false)}
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Name" value={selected.name} onChange={(v) => updateBot({ name: v })} />
                <Field label="Model" value={selected.model} onChange={(v) => updateBot({ model: v })} />
                <Field
                  label="Provider"
                  value={selected.provider}
                  onChange={(v) => updateBot({ provider: v as BotConfig["provider"] })}
                />
                <Field
                  label="Thinking"
                  value={selected.thinking}
                  onChange={(v) => updateBot({ thinking: v as BotConfig["thinking"] })}
                />
                <Field
                  label="Priority"
                  value={selected.priority}
                  onChange={(v) => updateBot({ priority: v as BotConfig["priority"] })}
                />
                <Field label="Schedule" value={selected.schedule} onChange={(v) => updateBot({ schedule: v })} />
                <Field label="Channel" value={selected.channel} onChange={(v) => updateBot({ channel: v })} />
                <div className="md:col-span-2">
                  <Field label="Allowed Tools" value={selected.allowedTools} onChange={(v) => updateBot({ allowedTools: v })} />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => {
                    saveSnapshot(bots);
                    persist(bots);
                    setShowConfig(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/35 bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-2 font-semibold text-slate-950 shadow-[0_0_20px_-12px_rgba(103,232,249,0.85)] transition hover:brightness-110"
                >
                  <Save size={14} /> Save Config
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Card({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_50px_-38px_rgba(34,211,238,0.65)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent" />
      <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/70">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{sub}</p>
    </div>
  );
}

function BatchButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: string;
  onClick: () => void;
  disabled: boolean;
  tone: "emerald" | "rose" | "amber" | "cyan";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-300/20 text-emerald-200 hover:bg-emerald-500/8"
      : tone === "rose"
        ? "border-rose-300/20 text-rose-200 hover:bg-rose-500/8"
        : tone === "amber"
          ? "border-amber-300/20 text-amber-200 hover:bg-amber-500/8"
          : "border-cyan-300/20 text-cyan-200 hover:bg-cyan-500/8";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-45 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-[11px] font-medium uppercase tracking-[0.2em] text-slate-300">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-white/12 bg-slate-900/70 px-3.5 py-2.5 text-sm normal-case tracking-normal text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition focus:border-cyan-300/45 focus:bg-slate-900 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.1)]"
      />
    </label>
  );
}
