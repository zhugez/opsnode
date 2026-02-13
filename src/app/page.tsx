"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, Line } from "@react-three/drei";
import * as THREE from "three";
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

function SentinelCharacter() {
  const rootRef = useRef<THREE.Group>(null!);
  const headRef = useRef<THREE.Group>(null!);
  const chestCoreRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(t * 1.2) * 0.04;
      rootRef.current.rotation.y = Math.sin(t * 0.35) * 0.12;
    }

    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 1.9) * 0.35;
      headRef.current.rotation.x = Math.cos(t * 1.4) * 0.06;
    }

    if (chestCoreRef.current) {
      const pulse = 1 + Math.sin(t * 2.5) * 0.08;
      chestCoreRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group ref={rootRef}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[1.05, 1.2, 0.62]} />
        <meshStandardMaterial color="#4e6f90" roughness={0.35} metalness={0.85} />
      </mesh>

      <mesh position={[0, 0.12, 0.32]}>
        <boxGeometry args={[0.7, 0.52, 0.08]} />
        <meshStandardMaterial color="#5d89ad" emissive="#123044" emissiveIntensity={0.45} metalness={0.7} roughness={0.25} />
      </mesh>

      <mesh ref={chestCoreRef} position={[0, 0.1, 0.38]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial color="#8fe8ff" emissive="#36ceff" emissiveIntensity={1.1} roughness={0.18} metalness={0.55} />
      </mesh>

      <group ref={headRef} position={[0, 0.98, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.24, 0.18, 4, 12]} />
          <meshStandardMaterial color="#5f86a8" roughness={0.3} metalness={0.84} />
        </mesh>
        <mesh position={[0, -0.03, 0.2]}>
          <boxGeometry args={[0.34, 0.12, 0.08]} />
          <meshStandardMaterial color="#9defff" emissive="#48ddff" emissiveIntensity={0.95} metalness={0.42} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.26, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.16, 12]} />
          <meshStandardMaterial color="#78cbff" emissive="#37acff" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <sphereGeometry args={[0.038, 12, 12]} />
          <meshStandardMaterial color="#c8f6ff" emissive="#67e6ff" emissiveIntensity={1.2} />
        </mesh>
      </group>

      <mesh position={[-0.68, 0.24, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.58, 4, 10]} />
        <meshStandardMaterial color="#4f6f8d" roughness={0.36} metalness={0.8} />
      </mesh>
      <mesh position={[0.68, 0.24, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.58, 4, 10]} />
        <meshStandardMaterial color="#4f6f8d" roughness={0.36} metalness={0.8} />
      </mesh>

      <mesh position={[0, -0.66, 0]}>
        <boxGeometry args={[0.62, 0.26, 0.42]} />
        <meshStandardMaterial color="#466480" roughness={0.4} metalness={0.78} />
      </mesh>

      <mesh position={[-0.2, -1.12, 0.02]} castShadow>
        <capsuleGeometry args={[0.1, 0.64, 4, 10]} />
        <meshStandardMaterial color="#4e6d89" roughness={0.34} metalness={0.82} />
      </mesh>
      <mesh position={[0.2, -1.12, 0.02]} castShadow>
        <capsuleGeometry args={[0.1, 0.64, 4, 10]} />
        <meshStandardMaterial color="#4e6d89" roughness={0.34} metalness={0.82} />
      </mesh>

      <mesh position={[0, -1.56, 0.15]}>
        <boxGeometry args={[0.75, 0.12, 0.5]} />
        <meshStandardMaterial color="#3f5c74" roughness={0.45} metalness={0.72} />
      </mesh>

      <mesh position={[0, 0.08, -0.38]}>
        <cylinderGeometry args={[0.16, 0.22, 0.38, 16]} />
        <meshStandardMaterial color="#3b5470" roughness={0.4} metalness={0.76} />
      </mesh>
      <mesh position={[0, 0.1, -0.52]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#91ecff" emissive="#2fd4ff" emissiveIntensity={0.9} roughness={0.2} metalness={0.6} />
      </mesh>
    </group>
  );
}

function NodeCore() {
  const relayLines: [number, number, number][][] = useMemo(
    () => [
      [
        [-1.6, 1.2, -1.1],
        [-0.6, 0.7, -0.4],
        [0, 0.2, 0],
        [0.9, 0.76, 0.32],
        [1.65, 1.08, 0.9],
      ],
      [
        [-1.5, -0.2, 1],
        [-0.6, -0.55, 0.42],
        [0, -0.9, 0.1],
        [0.78, -0.42, -0.32],
        [1.5, 0.1, -0.95],
      ],
      [
        [-0.95, 1.5, 0.6],
        [-0.35, 0.52, 0.22],
        [0.26, 0.1, -0.1],
        [0.95, 0.6, -0.7],
      ],
    ],
    [],
  );

  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight position={[3, 4, 2]} intensity={0.8} color="#9be9ff" />
      <pointLight position={[2.4, 2.1, 2.6]} intensity={1.2} color="#69d8ff" />
      <pointLight position={[-2.4, -1.1, 1.3]} intensity={0.65} color="#6076ff" />
      <pointLight position={[0, 1.8, -2]} intensity={0.55} color="#5dd8ff" />

      <Float speed={1} rotationIntensity={0.12} floatIntensity={0.45}>
        <SentinelCharacter />
      </Float>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.72, 0]}>
        <ringGeometry args={[1.55, 1.9, 56]} />
        <meshStandardMaterial color="#80deff" emissive="#2f8fb1" emissiveIntensity={0.55} metalness={0.7} roughness={0.22} side={THREE.DoubleSide} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.7, 0]}>
        <ringGeometry args={[2.2, 2.34, 64]} />
        <meshStandardMaterial color="#6ecbff" emissive="#275a82" emissiveIntensity={0.35} transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>

      {relayLines.map((line, idx) => (
        <Line key={idx} points={line} color={idx === 1 ? "#77b8ff" : "#a3e7ff"} lineWidth={1} transparent opacity={0.68} />
      ))}

      {relayLines.flat().map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.033, 10, 10]} />
          <meshStandardMaterial color="#d9f8ff" emissive="#66d8ff" emissiveIntensity={0.9} />
        </mesh>
      ))}

      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.5} maxPolarAngle={Math.PI * 0.62} minPolarAngle={Math.PI * 0.38} />
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
    "relative overflow-hidden rounded-[28px] border border-cyan-100/10 bg-slate-950/40 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_80px_-42px_rgba(56,189,248,0.8)]";
  const modeButton =
    "rounded-lg px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] transition duration-200";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03060d] px-4 py-6 font-sans text-slate-100 md:px-8 md:py-10 xl:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-[-10%] h-[430px] w-[430px] rounded-full bg-cyan-500/15 blur-[130px]" />
        <div className="absolute -right-20 top-[14%] h-[380px] w-[380px] rounded-full bg-blue-500/15 blur-[120px]" />
        <div className="absolute bottom-[-16%] left-[12%] h-[340px] w-[340px] rounded-full bg-sky-300/8 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,31,54,0.95)_0%,rgba(6,10,18,0.98)_58%,rgba(2,4,10,1)_100%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:56px_56px]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-12">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${panelShell} lg:col-span-8 p-5 md:p-7`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(34,211,238,0.12)_0%,transparent_40%,rgba(59,130,246,0.12)_100%)]" />
          <div className="pointer-events-none absolute -right-16 -top-14 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.34em] text-cyan-200/70">OpsNode Directive Array</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Command Cockpit</h1>
                <p className="mt-2 text-sm text-slate-300/90">3D command cockpit · Bot manager + config</p>
              </div>
              <span className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200 shadow-[0_0_24px_-10px_rgba(52,211,153,0.9)]">
                Live
              </span>
            </div>

            <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <button
                onClick={() => setViewMode("commander")}
                className={`${modeButton} ${
                  viewMode === "commander"
                    ? "bg-cyan-300 text-slate-950 shadow-[0_0_24px_-12px_rgba(103,232,249,1)]"
                    : "text-slate-300 hover:bg-white/8 hover:text-white"
                }`}
              >
                Commander
              </button>
              <button
                onClick={() => setViewMode("detail")}
                className={`${modeButton} ${
                  viewMode === "detail"
                    ? "bg-cyan-300 text-slate-950 shadow-[0_0_24px_-12px_rgba(103,232,249,1)]"
                    : "text-slate-300 hover:bg-white/8 hover:text-white"
                }`}
              >
                Detail
              </button>
            </div>

            <div className="relative h-[380px] overflow-hidden rounded-2xl border border-cyan-100/15 bg-[radial-gradient(circle_at_50%_18%,rgba(14,116,144,0.45)_0%,rgba(2,6,23,0.76)_55%,rgba(2,6,23,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_28px_70px_-42px_rgba(56,189,248,0.85)]">
              <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(125,211,252,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(125,211,252,0.06)_1px,transparent_1px)] [background-size:38px_38px]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(2,6,23,0.72)_100%)]" />
              <Canvas camera={{ position: [0, 0, 4.2], fov: 55 }}>
                <NodeCore />
              </Canvas>
            </div>

            {viewMode === "commander" ? (
              <div className="mt-4 rounded-2xl border border-cyan-100/12 bg-white/[0.03] p-4 backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/70">Tactical Map</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Sector Sweep · 24 Nodes</p>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const active = i % 5 === 0 || i === 7 || i === 18;
                    return (
                      <div
                        key={i}
                        className="relative h-8 overflow-hidden rounded-md border border-cyan-100/12 bg-gradient-to-br from-cyan-400/12 via-slate-950/65 to-blue-500/12"
                      >
                        <div
                          className={`absolute inset-0 bg-[radial-gradient(circle_at_28%_38%,rgba(125,211,252,0.55)_0%,transparent_62%)] ${
                            active ? "opacity-90" : "opacity-35"
                          }`}
                        />
                        <div
                          className={`absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${
                            active ? "bg-cyan-100 shadow-[0_0_12px_2px_rgba(103,232,249,0.7)]" : "bg-cyan-900/70"
                          }`}
                        />
                        <div className="absolute bottom-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 rounded-2xl border border-cyan-100/12 bg-white/[0.03] p-4 backdrop-blur-xl sm:grid-cols-2">
                <div className="rounded-xl border border-cyan-100/10 bg-slate-950/50 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/70">Selected Unit</p>
                  <p className="mt-2 text-xl font-semibold text-white">{selected?.name || "-"}</p>
                  <p className="mt-1 text-xs text-slate-300">{selected?.provider} · {selected?.model}</p>
                </div>
                <div className="grid gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-cyan-100/10 bg-slate-950/50 px-3 py-2.5 text-xs text-slate-200">
                    <CheckCircle2 size={14} className="text-emerald-300" />
                    Control plane integrity: {health}%
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-cyan-100/10 bg-slate-950/50 px-3 py-2.5 text-xs text-slate-200">
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
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(34,211,238,0.08)_0%,transparent_45%,rgba(96,165,250,0.08)_100%)]" />
          <div className="relative">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-white">Bot Manager</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={addBot}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/40 bg-gradient-to-r from-cyan-300 to-sky-300 px-3.5 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_24px_-12px_rgba(103,232,249,0.95)] transition hover:brightness-110"
                >
                  <Plus size={14} /> Add Bot
                </button>
                <button
                  onClick={rollback}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-100/20 bg-slate-900/55 px-3.5 py-2 text-sm text-slate-200 transition hover:border-cyan-200/35 hover:bg-cyan-300/10"
                >
                  <RotateCcw size={14} /> Rollback
                </button>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-100/12 bg-slate-900/45 p-2 text-xs">
              <span className="px-2 text-slate-300">Selected: {selectedBots.length}</span>
              <button onClick={() => applyBatchAction("enable")} className="rounded-lg border border-emerald-300/25 px-2 py-1 text-emerald-200 hover:bg-emerald-500/10">Enable</button>
              <button onClick={() => applyBatchAction("disable")} className="rounded-lg border border-rose-300/25 px-2 py-1 text-rose-200 hover:bg-rose-500/10">Disable</button>
              <button onClick={() => applyBatchAction("pause")} className="rounded-lg border border-amber-300/25 px-2 py-1 text-amber-200 hover:bg-amber-500/10">Pause</button>
              <button onClick={() => applyBatchAction("resume")} className="rounded-lg border border-cyan-300/25 px-2 py-1 text-cyan-200 hover:bg-cyan-500/10">Resume</button>
              <button onClick={() => setSelectedBots([])} className="rounded-lg border border-white/20 px-2 py-1 text-slate-300 hover:bg-white/10">Clear</button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {bots.map((b) => (
                <div
                  key={b.id}
                  className={`rounded-2xl border p-4 backdrop-blur-xl transition ${
                    selectedId === b.id
                      ? "border-cyan-200/45 bg-gradient-to-br from-cyan-400/16 via-slate-900/70 to-blue-500/14 shadow-[0_0_34px_-18px_rgba(34,211,238,0.9)]"
                      : "border-white/10 bg-slate-950/55 hover:border-cyan-100/30 hover:bg-slate-900/72"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedBots.includes(b.id)}
                        onChange={() => toggleBotSelection(b.id)}
                        className="h-4 w-4 rounded border-cyan-200/40 bg-slate-900 text-cyan-300"
                      />
                      <button className="text-left" onClick={() => setSelectedId(b.id)}>
                        <p className="text-base font-semibold text-white">{b.name}</p>
                        <p className="mt-0.5 text-xs text-slate-300">{b.provider} · {b.model}</p>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                          b.priority === "high"
                            ? "border border-rose-300/20 bg-rose-500/20 text-rose-200"
                            : b.priority === "med"
                              ? "border border-amber-300/20 bg-amber-500/20 text-amber-200"
                              : "border border-emerald-300/20 bg-emerald-500/20 text-emerald-200"
                        }`}
                      >
                        {b.priority}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                          b.status === "running"
                            ? "border border-emerald-300/20 bg-emerald-500/20 text-emerald-200"
                            : b.status === "paused"
                              ? "border border-amber-300/20 bg-amber-500/20 text-amber-200"
                              : "border border-slate-300/20 bg-slate-500/30 text-slate-200"
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
                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-100/22 bg-slate-900/45 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-cyan-200/45 hover:bg-cyan-300/10"
                    >
                      <Settings size={13} /> Config
                    </button>
                    <button
                      onClick={() =>
                        setBots((s) =>
                          s.map((x) => (x.id === b.id ? { ...x, status: x.status === "paused" ? "running" : "paused" } : x)),
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-100/22 bg-slate-900/45 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-cyan-200/45 hover:bg-cyan-300/10"
                    >
                      {b.status === "paused" ? <Play size={13} /> : <Pause size={13} />}
                      {b.status === "paused" ? "Resume" : "Pause"}
                    </button>
                    <button
                      onClick={() => setBots((s) => s.map((x) => (x.id === b.id ? { ...x, enabled: !x.enabled } : x)))}
                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-100/22 bg-slate-900/45 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-cyan-200/45 hover:bg-cyan-300/10"
                    >
                      <Power size={13} /> {b.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => deleteBot(b.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-300/22 bg-rose-500/5 px-2.5 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/14"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${panelShell} lg:col-span-4 p-5 md:p-6`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(34,211,238,0.08)_0%,transparent_35%,rgba(59,130,246,0.1)_100%)]" />
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Quick Actions</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">Gateway Dispatch</p>
            <div className="mt-5 space-y-3">
              <button
                onClick={() => sendGatewayAction("summon")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/35 bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-2.5 font-medium text-slate-950 shadow-[0_0_24px_-12px_rgba(103,232,249,0.9)] transition hover:brightness-110"
              >
                <Activity size={16} /> Summon All
              </button>
              <button
                onClick={() => sendGatewayAction("reset")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-100/22 bg-slate-900/60 px-4 py-2.5 text-cyan-100 transition hover:border-cyan-200/35 hover:bg-cyan-300/10"
              >
                <Brain size={16} /> Reset Context
              </button>
              <button
                onClick={() => setShowConfig(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/18 bg-slate-900/55 px-4 py-2.5 text-slate-100 transition hover:border-white/35 hover:bg-white/10"
              >
                <Settings size={16} /> Open Config Drawer
              </button>
            </div>
            <p className="mt-4 rounded-lg border border-cyan-100/12 bg-slate-900/55 px-3 py-2 text-xs text-slate-300">{gatewayMsg || "Gateway ready"}</p>
          </div>
        </section>
      </div>

      {showConfig && selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-4 backdrop-blur-sm md:items-center">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-cyan-100/20 bg-slate-950/85 p-5 shadow-[0_26px_80px_-35px_rgba(15,118,110,0.7)] backdrop-blur-2xl md:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(34,211,238,0.09)_0%,transparent_40%,rgba(59,130,246,0.1)_100%)]" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-semibold tracking-tight text-white">Config · {selected.name}</h3>
                <button
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 hover:text-white"
                  onClick={() => setShowConfig(false)}
                >
                  Close
                </button>
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

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => {
                    saveSnapshot(bots);
                    persist(bots);
                    setShowConfig(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/35 bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-2 font-semibold text-slate-950 shadow-[0_0_24px_-12px_rgba(103,232,249,0.9)] transition hover:brightness-110"
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
    <div className="relative overflow-hidden rounded-2xl border border-cyan-100/12 bg-white/[0.04] p-4 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_55px_-36px_rgba(34,211,238,0.8)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/55 to-transparent" />
      <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/75">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{sub}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-[11px] font-medium uppercase tracking-[0.2em] text-slate-300">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-white/12 bg-slate-900/70 px-3.5 py-2.5 text-sm normal-case tracking-normal text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition focus:border-cyan-300/55 focus:bg-slate-900 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.12)]"
      />
    </label>
  );
}
