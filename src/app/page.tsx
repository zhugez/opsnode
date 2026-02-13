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
    [-2, 1.2, -1],
    [-1, 0.3, 0.5],
    [0, 0, 0],
    [1, -0.3, -0.4],
    [2, 0.9, 0.8],
  ];
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[2, 2, 3]} intensity={1.2} color="#66e3ff" />
      <pointLight position={[-2, -1, 1]} intensity={0.8} color="#7c83ff" />
      <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.8}>
        <Sphere args={[1.1, 64, 64]}>
          <MeshDistortMaterial
            color="#5bd1ff"
            emissive="#1a6a8c"
            emissiveIntensity={0.6}
            roughness={0.1}
            metalness={0.35}
            distort={0.35}
            speed={2}
          />
        </Sphere>
      </Float>
      <Line points={points} color="#88a5ff" lineWidth={1.2} transparent opacity={0.7} />
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#d9f6ff" emissive="#82dfff" emissiveIntensity={0.8} />
        </mesh>
      ))}
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.9} />
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
  const [gatewayMsg, setGatewayMsg] = useState<string>("");

  useEffect(() => setBots(loadBots()), []);

  const selected = useMemo(() => bots.find((b) => b.id === selectedId) || bots[0], [bots, selectedId]);

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
    if (selectedId === id) setSelectedId(next[0].id);
  };

  const rollback = () => {
    const raw = localStorage.getItem(VERSIONS_KEY);
    const versions: ConfigVersion[] = raw ? JSON.parse(raw) : [];
    if (!versions.length) return;
    const [latest, ...rest] = versions;
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(rest));
    persist(latest.bots);
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#10213c_0%,#090d16_55%,#05070d_100%)] p-6 text-white md:p-10">
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-12">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-8 rounded-3xl border border-cyan-300/20 bg-slate-950/45 p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">OpsNode</h1>
              <p className="text-sm text-cyan-100/80">3D command cockpit · Bot manager + config</p>
            </div>
            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs text-emerald-300">LIVE</span>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <button onClick={() => setViewMode("commander")} className={`rounded-lg px-3 py-1.5 text-xs ${viewMode === "commander" ? "bg-cyan-500 text-slate-950" : "border border-white/20 text-slate-200"}`}>Commander</button>
            <button onClick={() => setViewMode("detail")} className={`rounded-lg px-3 py-1.5 text-xs ${viewMode === "detail" ? "bg-cyan-500 text-slate-950" : "border border-white/20 text-slate-200"}`}>Detail</button>
          </div>
          <div className="h-[360px] rounded-2xl border border-cyan-200/20 bg-slate-900/50">
            <Canvas camera={{ position: [0, 0, 4.2], fov: 55 }}>
              <NodeCore />
            </Canvas>
          </div>
          {viewMode === "commander" && (
            <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-slate-900/40 p-3">
              <p className="mb-2 text-xs text-cyan-200">Tactical Map</p>
              <div className="grid grid-cols-6 gap-1">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="h-6 rounded bg-cyan-400/10" />
                ))}
              </div>
            </div>
          )}
        </motion.section>

        <section className="grid gap-4 lg:col-span-4">
          <Card title="Bots" value={`${bots.length}`} sub={`${bots.filter((b) => b.enabled).length} enabled`} />
          <Card title="Health" value={`${health}%`} sub="Control plane availability" />
          <Card title="Mode" value="Phase 2" sub="Bot manager + config drawer" />
          <Card title="Gateway" value="Bound" sub="/api/gateway-action wired" />
        </section>

        <section className="lg:col-span-8 rounded-3xl border border-cyan-300/20 bg-slate-950/45 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Bot Manager</h2>
            <div className="flex gap-2">
              <button onClick={addBot} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"><Plus size={14} /> Add Bot</button>
              <button onClick={rollback} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 px-3 py-2 text-sm hover:bg-cyan-500/10"><RotateCcw size={14} /> Rollback</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {bots.map((b) => (
              <div key={b.id} className={`rounded-2xl border p-4 ${selectedId === b.id ? "border-cyan-300/60 bg-cyan-500/10" : "border-white/10 bg-slate-900/60"}`}>
                <div className="mb-2 flex items-center justify-between">
                  <button className="text-left" onClick={() => setSelectedId(b.id)}>
                    <p className="font-semibold">{b.name}</p>
                    <p className="text-xs text-slate-300">{b.provider} · {b.model}</p>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] uppercase ${b.priority === "high" ? "bg-rose-500/20 text-rose-300" : b.priority === "med" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}>{b.priority}</span>
                    <span className={`rounded-full px-2 py-1 text-xs ${b.status === "running" ? "bg-emerald-500/20 text-emerald-300" : b.status === "paused" ? "bg-amber-500/20 text-amber-300" : "bg-slate-500/30 text-slate-200"}`}>{b.status}</span>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setSelectedId(b.id); setShowConfig(true); }} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10"><Settings size={13} /> Config</button>
                  <button onClick={() => setBots((s) => s.map((x) => x.id === b.id ? { ...x, status: x.status === "paused" ? "running" : "paused" } : x))} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10">{b.status === "paused" ? <Play size={13} /> : <Pause size={13} />}{b.status === "paused" ? "Resume" : "Pause"}</button>
                  <button onClick={() => setBots((s) => s.map((x) => x.id === b.id ? { ...x, enabled: !x.enabled } : x))} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10"><Power size={13} /> {b.enabled ? "Disable" : "Enable"}</button>
                  <button onClick={() => deleteBot(b.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-300/20 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/10"><Trash2 size={13} /> Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-4 rounded-3xl border border-cyan-300/20 bg-slate-950/45 p-5">
          <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
          <div className="space-y-3">
            <button onClick={() => sendGatewayAction("summon")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-medium text-slate-950 hover:bg-cyan-400"><Activity size={16} /> Summon All</button>
            <button onClick={() => sendGatewayAction("reset")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 px-4 py-2.5 text-cyan-200 hover:bg-cyan-500/10"><Brain size={16} /> Reset Context</button>
            <button onClick={() => setShowConfig(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 hover:bg-white/10"><Settings size={16} /> Open Config Drawer</button>
          </div>
          <p className="mt-4 text-xs text-slate-300">{gatewayMsg || "Gateway ready"}</p>
        </section>
      </div>

      {showConfig && selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
          <div className="w-full max-w-2xl rounded-2xl border border-cyan-300/20 bg-slate-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Config · {selected.name}</h3>
              <button className="text-sm text-slate-300" onClick={() => setShowConfig(false)}>Close</button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name" value={selected.name} onChange={(v) => updateBot({ name: v })} />
              <Field label="Model" value={selected.model} onChange={(v) => updateBot({ model: v })} />
              <Field label="Provider" value={selected.provider} onChange={(v) => updateBot({ provider: v as BotConfig["provider"] })} />
              <Field label="Thinking" value={selected.thinking} onChange={(v) => updateBot({ thinking: v as BotConfig["thinking"] })} />
              <Field label="Priority" value={selected.priority} onChange={(v) => updateBot({ priority: v as BotConfig["priority"] })} />
              <Field label="Schedule" value={selected.schedule} onChange={(v) => updateBot({ schedule: v })} />
              <Field label="Channel" value={selected.channel} onChange={(v) => updateBot({ channel: v })} />
              <div className="md:col-span-2">
                <Field label="Allowed Tools" value={selected.allowedTools} onChange={(v) => updateBot({ allowedTools: v })} />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { saveSnapshot(bots); persist(bots); setShowConfig(false); }} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400"><Save size={14} /> Save Config</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Card({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-slate-900/60 p-4 backdrop-blur-xl">
      <p className="text-xs text-cyan-200/80">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{sub}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-slate-300">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50" />
    </label>
  );
}
