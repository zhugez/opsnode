"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, Line } from "@react-three/drei";
import { Group, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { motion } from "framer-motion";
import {
  Activity,
  Brain,
  CheckCircle2,
  Clock3,
  Save,
  Settings,
  Trash2,
  RotateCcw,
  Pause,
  Play,
  Power,
  Sparkles,
  Radar,
  Swords,
  Shield,
} from "lucide-react";

type BotArchetype = "sentinel" | "sniper" | "analyst" | "medic";
type BotTier = "I" | "II" | "III";

type BotConfig = {
  id: string;
  name: string;
  callsign: string;
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
  archetype: BotArchetype;
  tier: BotTier;
  avatar: string;
  deskSlot?: number;
};

type ConfigVersion = {
  at: string;
  bots: BotConfig[];
};

type RecruitDraft = {
  name: string;
  callsign: string;
  archetype: BotArchetype;
  tier: BotTier;
  provider: BotConfig["provider"];
  model: string;
  thinking: BotConfig["thinking"];
  priority: BotConfig["priority"];
  allowedTools: string;
  schedule: string;
  channel: string;
};

const STORAGE_KEY = "opsnode.bots.v1";
const VERSIONS_KEY = "opsnode.bots.versions.v1";

const ARCHETYPES: Record<
  BotArchetype,
  { label: string; role: string; avatar: string; aura: string; chip: string; tone: string }
> = {
  sentinel: {
    label: "Sentinel",
    role: "Frontline defense",
    avatar: "/assets/characters/sentinel-card.png",
    aura: "from-sky-400/20 via-cyan-500/10 to-transparent",
    chip: "border-cyan-300/30 bg-cyan-500/12 text-cyan-100",
    tone: "text-cyan-200",
  },
  sniper: {
    label: "Sniper",
    role: "Precision strike",
    avatar: "/assets/characters/sniper-card.png",
    aura: "from-fuchsia-400/20 via-violet-500/10 to-transparent",
    chip: "border-fuchsia-300/30 bg-fuchsia-500/12 text-fuchsia-100",
    tone: "text-fuchsia-200",
  },
  analyst: {
    label: "Analyst",
    role: "Intel & planning",
    avatar: "/assets/characters/analyst-card.png",
    aura: "from-indigo-400/20 via-blue-500/10 to-transparent",
    chip: "border-indigo-300/30 bg-indigo-500/12 text-indigo-100",
    tone: "text-indigo-200",
  },
  medic: {
    label: "Medic",
    role: "Recovery support",
    avatar: "/assets/characters/medic-card.png",
    aura: "from-emerald-400/20 via-teal-500/10 to-transparent",
    chip: "border-emerald-300/30 bg-emerald-500/12 text-emerald-100",
    tone: "text-emerald-200",
  },
};

const CALLSIGN_POOL: Record<BotArchetype, string[]> = {
  sentinel: ["AEGIS", "BASTION", "IRONWALL", "VANGUARD", "LOCKDOWN"],
  sniper: ["LONGSHOT", "DEADEYE", "PINPOINT", "VANTAGE", "FALCON"],
  analyst: ["ORBIT", "SPECTRA", "NEXUS", "CIRCUIT", "ECHO"],
  medic: ["LIFELINE", "AURORA", "PATCH", "REMEDY", "REVIVE"],
};

const defaults: BotConfig[] = [
  {
    id: "yasna-main",
    name: "Yasna",
    callsign: "ORBIT",
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
    archetype: "analyst",
    tier: "III",
    avatar: ARCHETYPES.analyst.avatar,
    deskSlot: 0,
  },
  {
    id: "zhu-ops",
    name: "Zhu",
    callsign: "AEGIS",
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
    archetype: "sentinel",
    tier: "II",
    avatar: ARCHETYPES.sentinel.avatar,
    deskSlot: 1,
  },
];

const initialRecruitDraft: RecruitDraft = {
  name: "",
  callsign: "",
  archetype: "sentinel",
  tier: "I",
  provider: "openai-codex",
  model: "gpt-5.3-codex",
  thinking: "low",
  priority: "low",
  allowedTools: "exec, web_search",
  schedule: "manual",
  channel: "telegram",
};

function resolveAvatar(avatar: string | undefined, archetype: BotArchetype) {
  if (!avatar || !avatar.startsWith("/")) return ARCHETYPES[archetype].avatar;
  return avatar;
}

function normalizeCallsign(v: string | undefined) {
  return (v || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 18);
}

function nextAvailableCallsign(archetype: BotArchetype, existing: BotConfig[]) {
  const used = new Set(existing.map((b) => normalizeCallsign(b.callsign)).filter(Boolean));
  for (const candidate of CALLSIGN_POOL[archetype]) {
    if (!used.has(candidate)) return candidate;
  }
  const stem = ARCHETYPES[archetype].label.toUpperCase();
  let n = 1;
  while (used.has(`${stem}-${n}`)) n += 1;
  return `${stem}-${n}`;
}

type Vec3 = [number, number, number];

const ARCHETYPE_RENDER: Record<
  BotArchetype,
  { color: string; accent: string; icon: string }
> = {
  sentinel: { color: "#22d3ee", accent: "#67e8f9", icon: "shield" },
  sniper: { color: "#d946ef", accent: "#f0abfc", icon: "reticle" },
  analyst: { color: "#6366f1", accent: "#a5b4fc", icon: "core" },
  medic: { color: "#10b981", accent: "#6ee7b7", icon: "cross" },
};

const STATUS_STYLE: Record<BotConfig["status"], { color: string; accent: string }> = {
  idle: { color: "#94a3b8", accent: "#cbd5e1" },
  running: { color: "#22c55e", accent: "#86efac" },
  paused: { color: "#f59e0b", accent: "#fcd34d" },
};

const DESK_SLOT_COUNT = 12;

function firstFreeDeskSlot(existing: BotConfig[]) {
  const used = new Set(existing.map((b) => b.deskSlot).filter((slot): slot is number => Number.isInteger(slot)));
  for (let i = 0; i < DESK_SLOT_COUNT; i += 1) {
    if (!used.has(i)) return i;
  }
  return existing.length % DESK_SLOT_COUNT;
}

function assignDeskSlots(list: BotConfig[]) {
  const used = new Set<number>();
  return list.map((bot, i) => {
    const raw = bot.deskSlot;
    const valid = Number.isInteger(raw) && (raw as number) >= 0 && (raw as number) < DESK_SLOT_COUNT && !used.has(raw as number);
    const deskSlot = valid ? (raw as number) : (() => {
      for (let slot = 0; slot < DESK_SLOT_COUNT; slot += 1) {
        if (!used.has(slot)) return slot;
      }
      return i % DESK_SLOT_COUNT;
    })();
    used.add(deskSlot);
    return { ...bot, deskSlot };
  });
}

function unitSlotPosition(i: number): Vec3 {
  const row = Math.floor(i / 4);
  const col = i % 4;
  return [col * 0.78 - 1.17, 0.08, row * 0.66 - 0.24];
}

function formationSlot(i: number): Vec3 {
  const ring: Vec3[] = [
    [0, 0.11, 0.34],
    [-0.5, 0.11, 0.05],
    [0.5, 0.11, 0.05],
    [-0.5, 0.11, -0.33],
    [0.5, 0.11, -0.33],
    [0, 0.11, -0.58],
  ];
  return ring[i] ?? [((i % 3) - 1) * 0.45, 0.11, -0.62 - Math.floor(i / 3) * 0.26];
}

function SceneEnvironment({ onClearSelection }: { onClearSelection: () => void }) {
  const cableRun: Vec3[] = [
    [-1.6, 0.12, 0.3],
    [-0.8, 0.16, 0.1],
    [0, 0.14, 0],
    [0.8, 0.16, -0.1],
    [1.6, 0.12, -0.3],
  ];

  return (
    <>
      <color attach="background" args={["#0f172a"]} />
      <ambientLight intensity={0.56} />
      <directionalLight position={[4, 5, 2]} intensity={1.2} color="#d8ecff" />
      <pointLight position={[0, 2.2, 1.4]} intensity={0.7} color="#7dd3fc" />
      <pointLight position={[0, 0.95, -2.2]} intensity={0.42} color="#6366f1" />

      <mesh position={[0, -0.58, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onClearSelection}>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color="#192538" roughness={0.86} metalness={0.08} />
      </mesh>

      <mesh position={[0, 1.0, -2.35]}>
        <boxGeometry args={[6.4, 2.8, 0.08]} />
        <meshStandardMaterial color="#1e2e45" roughness={0.3} metalness={0.2} />
      </mesh>

      <mesh position={[0, 0.07, -0.25]}>
        <boxGeometry args={[2.9, 0.14, 1.44]} />
        <meshStandardMaterial color="#2b3c57" roughness={0.34} metalness={0.48} />
      </mesh>

      {Array.from({ length: DESK_SLOT_COUNT }).map((_, i) => {
        const [x, y, z] = unitSlotPosition(i);
        return (
          <group key={`desk-slot-${i}`} position={[x, y - 0.05, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.18, 0.22, 28]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.24} />
            </mesh>
            <mesh position={[0, -0.01, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.02, 20]} />
              <meshStandardMaterial color="#233348" roughness={0.75} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.075, -0.14]}>
              <boxGeometry args={[0.12, 0.05, 0.02]} />
              <meshStandardMaterial color="#334155" emissive="#164e63" emissiveIntensity={0.3} />
            </mesh>
          </group>
        );
      })}

      {[-0.95, -0.32, 0.32, 0.95].map((x, i) => (
        <group key={i} position={[x, 0.38, -0.74]}>
          <mesh>
            <boxGeometry args={[0.5, 0.31, 0.03]} />
            <meshStandardMaterial color="#7dd3fc" emissive="#0e4f73" emissiveIntensity={0.75} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
            <boxGeometry args={[0.08, 0.16, 0.08]} />
            <meshStandardMaterial color="#7b8ca7" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {[-1.0, 1.0].map((x, i) => (
        <group key={i} position={[x, -0.22, 0.42]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.2, 0.22, 20]} />
            <meshStandardMaterial color="#4b5563" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.2, -0.08]}>
            <boxGeometry args={[0.34, 0.28, 0.24]} />
            <meshStandardMaterial color="#334155" roughness={0.56} />
          </mesh>
        </group>
      ))}

      <Float speed={1} rotationIntensity={0.09} floatIntensity={0.14}>
        <mesh position={[0, 0.72, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.52, 0.018, 16, 100]} />
          <meshStandardMaterial color="#93c5fd" emissive="#1d4ed8" emissiveIntensity={0.62} />
        </mesh>
      </Float>

      <Line points={cableRun} color="#7dd3fc" lineWidth={1.2} transparent opacity={0.46} />
      <Line points={[[0, 0.42, -0.72], [0, 0.72, -0.12], [0, 1.4, -2.3]]} color="#93c5fd" lineWidth={0.8} transparent opacity={0.35} />
    </>
  );
}

function UnitActor({
  bot,
  home,
  formation,
  selected,
  grouped,
  onSelect,
  seed,
  shouldSpawn,
}: {
  bot: BotConfig;
  home: Vec3;
  formation: Vec3;
  selected: boolean;
  grouped: boolean;
  onSelect: (id: string, additive: boolean) => void;
  seed: number;
  shouldSpawn: boolean;
}) {
  const ref = useRef<Group>(null);
  const bodyMatRef = useRef<MeshStandardMaterial>(null);
  const headMatRef = useRef<MeshStandardMaterial>(null);
  const iconMatRef = useRef<MeshStandardMaterial>(null);
  const spawnGlowMatRef = useRef<MeshBasicMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const spawnProgressRef = useRef(shouldSpawn ? 0 : 1);
  const style = ARCHETYPE_RENDER[bot.archetype];
  const statusStyle = STATUS_STYLE[bot.status];

  useEffect(() => {
    if (shouldSpawn) spawnProgressRef.current = 0;
  }, [shouldSpawn]);

  useFrame((state, delta) => {
    const group = ref.current;
    if (!group) return;

    const t = state.clock.elapsedTime;
    const idleLift = Math.sin(t * 1.4 + seed * 0.7) * 0.03;
    const pulse = grouped ? 1 + Math.sin(t * 4.6) * 0.06 : 1;
    const target = grouped ? formation : home;
    const yTarget = target[1] + idleLift + (selected ? 0.035 : 0);

    const lerp = 1 - Math.exp(-5.5 * delta);
    group.position.x += (target[0] - group.position.x) * lerp;
    group.position.y += (yTarget - group.position.y) * lerp;
    group.position.z += (target[2] - group.position.z) * lerp;

    const baseYaw = grouped ? Math.atan2(-target[0], -target[2] + 0.2) : Math.sin(t * 0.3 + seed) * 0.1;
    group.rotation.y += (baseYaw - group.rotation.y) * lerp;

    const nextSpawn = Math.min(1, spawnProgressRef.current + delta / 0.72);
    spawnProgressRef.current = nextSpawn;
    const spawnEase = 1 - Math.pow(1 - nextSpawn, 3);
    const spawnOvershoot = shouldSpawn ? Math.sin(Math.min(1, nextSpawn) * Math.PI) * 0.08 : 0;

    const targetScale = (selected ? 1.16 : 1) * (hovered ? 1.05 : 1) * pulse * (0.55 + spawnEase * 0.45 + spawnOvershoot);
    group.scale.x += (targetScale - group.scale.x) * lerp;
    group.scale.y += (targetScale - group.scale.y) * lerp;
    group.scale.z += (targetScale - group.scale.z) * lerp;

    const visibleOpacity = Math.min(1, Math.max(0.06, spawnEase));
    const glowIntensity = (1 - spawnEase) * 0.9;

    if (bodyMatRef.current) {
      bodyMatRef.current.opacity = visibleOpacity;
      bodyMatRef.current.emissiveIntensity = (selected ? 0.34 : 0.12) + glowIntensity * 0.45;
    }
    if (headMatRef.current) {
      headMatRef.current.opacity = visibleOpacity;
      headMatRef.current.emissiveIntensity = 0.42 + glowIntensity * 0.3;
    }
    if (iconMatRef.current) {
      iconMatRef.current.opacity = visibleOpacity;
      iconMatRef.current.emissiveIntensity = 0.26 + glowIntensity * 0.25;
    }
    if (spawnGlowMatRef.current) {
      spawnGlowMatRef.current.opacity = glowIntensity;
    }
  });

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect(bot.id, e.nativeEvent.shiftKey || e.nativeEvent.metaKey || e.nativeEvent.ctrlKey);
  };

  return (
    <group
      ref={ref}
      position={home}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onPointerDown={onPointerDown}
    >
      <mesh position={[0, -0.03, 0]}>
        <cylinderGeometry args={[0.18, 0.24, 0.05, 20]} />
        <meshStandardMaterial color="#0f172a" roughness={0.95} metalness={0.12} />
      </mesh>

      <mesh position={[0, 0.08, 0]}>
        {bot.archetype === "sentinel" && <boxGeometry args={[0.24, 0.24, 0.24]} />}
        {bot.archetype === "sniper" && <coneGeometry args={[0.16, 0.33, 14]} />}
        {bot.archetype === "analyst" && <octahedronGeometry args={[0.19, 0]} />}
        {bot.archetype === "medic" && <capsuleGeometry args={[0.1, 0.18, 6, 12]} />}
        <meshStandardMaterial
          ref={bodyMatRef}
          transparent
          color={style.color}
          emissive={style.color}
          emissiveIntensity={selected ? 0.34 : 0.12}
          roughness={0.42}
          metalness={0.2}
        />
      </mesh>

      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial ref={headMatRef} transparent color={style.accent} emissive={style.accent} emissiveIntensity={0.42} />
      </mesh>

      {style.icon === "shield" && (
        <mesh position={[0, 0.08, 0.16]}>
          <cylinderGeometry args={[0.07, 0.045, 0.04, 6]} />
          <meshStandardMaterial ref={iconMatRef} transparent color={style.accent} roughness={0.3} metalness={0.45} emissive={style.accent} emissiveIntensity={0.2} />
        </mesh>
      )}
      {style.icon === "reticle" && (
        <group position={[0, 0.08, 0.16]}>
          <mesh>
            <torusGeometry args={[0.07, 0.01, 8, 24]} />
            <meshStandardMaterial ref={iconMatRef} transparent color={style.accent} emissive={style.accent} emissiveIntensity={0.3} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.12, 0.006, 0.006]} />
            <meshStandardMaterial color={style.accent} transparent opacity={0.95} />
          </mesh>
        </group>
      )}
      {style.icon === "core" && (
        <mesh position={[0, 0.08, 0.16]}>
          <icosahedronGeometry args={[0.06, 0]} />
          <meshStandardMaterial ref={iconMatRef} transparent color={style.accent} emissive={style.accent} emissiveIntensity={0.24} />
        </mesh>
      )}
      {style.icon === "cross" && (
        <group position={[0, 0.08, 0.16]}>
          <mesh>
            <boxGeometry args={[0.03, 0.11, 0.03]} />
            <meshStandardMaterial ref={iconMatRef} transparent color={style.accent} emissive={style.accent} emissiveIntensity={0.22} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.11, 0.03, 0.03]} />
            <meshStandardMaterial color={style.accent} transparent opacity={0.95} />
          </mesh>
        </group>
      )}

      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.28, 32]} />
        <meshBasicMaterial ref={spawnGlowMatRef} color={style.accent} transparent opacity={0} />
      </mesh>

      <group position={[0, 0.5, 0]}>
        <mesh>
          <sphereGeometry args={[0.036, 10, 10]} />
          <meshStandardMaterial color={statusStyle.color} emissive={statusStyle.color} emissiveIntensity={0.5} />
        </mesh>
        {bot.status === "running" && (
          <mesh position={[0.08, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.024, 0.06, 3]} />
            <meshStandardMaterial color={statusStyle.accent} emissive={statusStyle.accent} emissiveIntensity={0.25} />
          </mesh>
        )}
        {bot.status === "paused" && (
          <group position={[0.085, 0, 0]}>
            <mesh position={[-0.012, 0, 0]}>
              <boxGeometry args={[0.01, 0.05, 0.01]} />
              <meshStandardMaterial color={statusStyle.accent} />
            </mesh>
            <mesh position={[0.012, 0, 0]}>
              <boxGeometry args={[0.01, 0.05, 0.01]} />
              <meshStandardMaterial color={statusStyle.accent} />
            </mesh>
          </group>
        )}
        {bot.status === "idle" && (
          <mesh position={[0.085, 0, 0]}>
            <torusGeometry args={[0.02, 0.006, 8, 20]} />
            <meshStandardMaterial color={statusStyle.accent} emissive={statusStyle.accent} emissiveIntensity={0.2} />
          </mesh>
        )}
      </group>

      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
          <ringGeometry args={[0.2, 0.24, 32]} />
          <meshBasicMaterial color={style.accent} transparent opacity={0.75} />
        </mesh>
      )}
    </group>
  );
}

function NodeCore({
  bots,
  selectedBots,
  onUnitSelect,
  onClearSelection,
  spawnedBotIds,
}: {
  bots: BotConfig[];
  selectedBots: string[];
  onUnitSelect: (id: string, additive: boolean) => void;
  onClearSelection: () => void;
  spawnedBotIds: string[];
}) {
  const squad = useMemo(
    () => [...bots].sort((a, b) => (a.deskSlot ?? Number.MAX_SAFE_INTEGER) - (b.deskSlot ?? Number.MAX_SAFE_INTEGER)).slice(0, DESK_SLOT_COUNT),
    [bots],
  );
  const selectedSet = useMemo(() => new Set(selectedBots), [selectedBots]);
  const spawnedSet = useMemo(() => new Set(spawnedBotIds), [spawnedBotIds]);
  const grouped = selectedBots.length > 1;

  const formationMap = useMemo(() => {
    const map = new Map<string, Vec3>();
    selectedBots.forEach((id, i) => map.set(id, formationSlot(i)));
    return map;
  }, [selectedBots]);

  return (
    <>
      <SceneEnvironment onClearSelection={onClearSelection} />
      {squad.map((bot, i) => {
        const slot = bot.deskSlot ?? i;
        const home = unitSlotPosition(slot);
        return (
          <UnitActor
            key={bot.id}
            bot={bot}
            home={home}
            formation={formationMap.get(bot.id) ?? home}
            selected={selectedSet.has(bot.id)}
            grouped={grouped && selectedSet.has(bot.id)}
            onSelect={onUnitSelect}
            seed={slot + 1}
            shouldSpawn={spawnedSet.has(bot.id)}
          />
        );
      })}
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.16} maxPolarAngle={Math.PI / 2.05} minPolarAngle={Math.PI / 2.9} />
    </>
  );
}

function makeBotId(existing: BotConfig[]) {
  const used = new Set(existing.map((b) => b.id));
  let candidate = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  while (used.has(candidate)) {
    candidate = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return candidate;
}

function loadBots(): BotConfig[] {
  if (typeof window === "undefined") return assignDeskSlots(defaults);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<BotConfig>[]) : defaults;
    const hydrated: BotConfig[] = [];

    const seenRawIds = new Set<string>();
    const seenFingerprint = new Set<string>();

    parsed.forEach((b, i) => {
      const fallback = defaults[Math.min(i, defaults.length - 1)] || defaults[0];
      const archetype = (b.archetype as BotArchetype) || fallback.archetype || "sentinel";
      const rawCallsign = normalizeCallsign((b as Partial<BotConfig>).callsign);
      const callsign =
        rawCallsign && !hydrated.some((x) => x.callsign === rawCallsign)
          ? rawCallsign
          : nextAvailableCallsign(archetype, hydrated);

      const rawId = typeof b.id === "string" ? b.id : "";
      if (rawId && seenRawIds.has(rawId)) return;
      if (rawId) seenRawIds.add(rawId);

      const nameForFp = (typeof b.name === "string" ? b.name : fallback.name || "").trim().toLowerCase();
      const fingerprint = `${nameForFp}|${callsign}|${archetype}`;
      if (seenFingerprint.has(fingerprint)) return;
      seenFingerprint.add(fingerprint);

      const id = rawId || makeBotId(hydrated);

      hydrated.push({
        ...fallback,
        ...b,
        id,
        callsign,
        priority: (b.priority as BotConfig["priority"]) || fallback.priority || "med",
        archetype,
        tier: (b.tier as BotTier) || fallback.tier || "I",
        avatar: resolveAvatar(b.avatar, archetype),
        deskSlot: Number.isInteger(b.deskSlot) ? (b.deskSlot as number) : fallback.deskSlot,
      } as BotConfig);
    });

    return assignDeskSlots(hydrated);
  } catch {
    return assignDeskSlots(defaults);
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
  const [showRecruitMenu, setShowRecruitMenu] = useState(false);
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [gatewayMsg, setGatewayMsg] = useState<string>("");
  const [recruitDraft, setRecruitDraft] = useState<RecruitDraft>(initialRecruitDraft);
  const [spawnedBotIds, setSpawnedBotIds] = useState<string[]>([]);

  useEffect(() => {
    const loaded = loadBots();
    setBots(loaded);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
  }, []);

  const selected = useMemo(() => bots.find((b) => b.id === selectedId) || bots[0], [bots, selectedId]);
  const selectedCount = selectedBots.length;

  const selectedBotUnits = useMemo(() => bots.filter((b) => selectedBots.includes(b.id)), [bots, selectedBots]);

  const loadoutUnits = useMemo(() => {
    if (selectedBotUnits.length) return selectedBotUnits.slice(0, 4);
    return bots.filter((b) => b.enabled).slice(0, 4);
  }, [bots, selectedBotUnits]);

  const tacticalCells = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const row = Math.floor(i / 4);
      const col = i % 4;
      const linked = i < loadoutUnits.length ? loadoutUnits[i] : undefined;
      return {
        id: i,
        row,
        col,
        focused: !!linked,
        linked,
      };
    });
  }, [loadoutUnits]);

  const persist = (next: BotConfig[]) => {
    const seen = new Set<string>();
    const sanitized = assignDeskSlots(
      next.filter((b) => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      }),
    );
    setBots(sanitized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  };

  const recruitBot = () => {
    const id = makeBotId(bots);
    const archetype = recruitDraft.archetype;
    const callsign = normalizeCallsign(recruitDraft.callsign) || nextAvailableCallsign(archetype, bots);
    const next: BotConfig[] = [
      ...bots,
      {
        id,
        name: recruitDraft.name.trim() || `${ARCHETYPES[archetype].label} Operator ${bots.length + 1}`,
        callsign,
        status: "idle",
        priority: recruitDraft.priority,
        enabled: true,
        model: recruitDraft.model,
        provider: recruitDraft.provider,
        thinking: recruitDraft.thinking,
        allowedTools: recruitDraft.allowedTools,
        schedule: recruitDraft.schedule,
        channel: recruitDraft.channel,
        lastRun: "-",
        archetype,
        tier: recruitDraft.tier,
        avatar: ARCHETYPES[archetype].avatar,
        deskSlot: firstFreeDeskSlot(bots),
      },
    ];

    saveSnapshot(bots);
    persist(next);
    setSpawnedBotIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    window.setTimeout(() => {
      setSpawnedBotIds((prev) => prev.filter((x) => x !== id));
    }, 1400);
    setSelectedId(id);
    setShowRecruitMenu(false);
    setRecruitDraft(initialRecruitDraft);
    setGatewayMsg(`Recruited [${callsign}] ${next[next.length - 1].name} as ${ARCHETYPES[archetype].label}`);
  };

  const updateBot = (patch: Partial<BotConfig>) => {
    if (!selected) return;
    const next = bots.map((b) => {
      if (b.id !== selected.id) return b;
      const merged = { ...b, ...patch };
      if (patch.archetype) {
        merged.avatar = ARCHETYPES[patch.archetype].avatar;
      }
      if (typeof patch.callsign === "string") {
        const normalized = normalizeCallsign(patch.callsign);
        const taken = bots.some((x) => x.id !== b.id && x.callsign === normalized);
        merged.callsign =
          normalized && !taken ? normalized : nextAvailableCallsign(merged.archetype, bots.filter((x) => x.id !== b.id));
      }
      return merged;
    });
    persist(next);
  };

  const deleteBot = (id: string) => {
    const old = [...bots];
    const next = bots.filter((b) => b.id !== id);
    if (!next.length) return;
    saveSnapshot(old);
    persist(next);
    setSelectedBots((prev) => prev.filter((x) => x !== id));
    setSpawnedBotIds((prev) => prev.filter((x) => x !== id));
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
    setSpawnedBotIds((prev) => prev.filter((id) => latest.bots.some((b) => b.id === id)));
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
    setGatewayMsg(`Batch action applied: ${action} (${selectedBots.length} units)`);
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
    "relative overflow-hidden rounded-[26px] border border-slate-200/10 bg-slate-900/45 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_28px_58px_-42px_rgba(59,130,246,0.45)]";
  const modeButton =
    "rounded-lg px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] transition duration-200";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1220] px-4 py-6 font-sans text-slate-100 md:px-8 md:py-10 xl:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(30,41,59,0.96)_0%,rgba(15,23,42,0.94)_48%,rgba(7,12,24,0.98)_100%)]" />
        <div className="absolute left-0 top-0 h-[46%] w-full bg-[radial-gradient(ellipse_at_top,rgba(148,163,184,0.18)_0%,rgba(148,163,184,0.04)_48%,transparent_78%)]" />
        <div className="absolute -left-16 top-[4%] h-[320px] w-[320px] rounded-full bg-sky-300/10 blur-[120px]" />
        <div className="absolute -right-10 top-[10%] h-[280px] w-[280px] rounded-full bg-indigo-300/10 blur-[120px]" />
        <div className="absolute bottom-[-12%] left-[22%] h-[220px] w-[360px] rounded-[50%] bg-slate-300/8 blur-[120px]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] [background-size:72px_72px]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-12">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${panelShell} lg:col-span-8 p-5 md:p-7`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(125,211,252,0.08)_0%,transparent_42%,rgba(165,180,252,0.08)_100%)]" />
          <div className="relative">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.34em] text-cyan-100/60">OpsNode Corporate Command</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Commander Bridge</h1>
                <p className="mt-2 text-sm text-slate-300/85">Assemble your squad, tune loadouts, and manage operations from HQ</p>
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

            <div className="relative h-[360px] overflow-hidden rounded-2xl border border-slate-200/14 bg-[linear-gradient(180deg,rgba(30,41,59,0.92)_0%,rgba(15,23,42,0.86)_58%,rgba(9,14,26,0.94)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_24px_60px_-44px_rgba(96,165,250,0.55)]">
              <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:42px_42px]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(7,12,24,0.66)_100%)]" />

              <motion.div
                className="pointer-events-none absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-slate-100/12 to-transparent"
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
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/25 bg-violet-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-violet-100">
                  <Sparkles size={11} /> {loadoutUnits.length} in loadout
                </span>
              </div>

              <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between gap-4 rounded-lg border border-slate-200/12 bg-slate-900/50 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-slate-100/80">
                <span>HQ Environment Preview</span>
                <span>{loadoutUnits.length > 0 ? `${loadoutUnits.length} units on duty` : "Recruit units to fill roster"}</span>
              </div>

              <Canvas camera={{ position: [0, 0.35, 4.3], fov: 55 }}>
                <NodeCore
                  bots={bots.filter((b) => b.enabled)}
                  selectedBots={selectedBots}
                  spawnedBotIds={spawnedBotIds}
                  onUnitSelect={(id, additive) => {
                    setSelectedId(id);
                    setSelectedBots((prev) => {
                      if (additive) {
                        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
                      }
                      return [id];
                    });
                  }}
                  onClearSelection={() => setSelectedBots([])}
                />
              </Canvas>
            </div>

            {viewMode === "commander" ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em] text-cyan-200/65">Squad Loadout</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">Alpha · Bravo · Charlie · Delta</p>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-300">{selectedCount ? "Manual selection" : "Auto from enabled units"}</div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const bot = loadoutUnits[i];
                    const slotLabel = ["Alpha", "Bravo", "Charlie", "Delta"][i];
                    const a = bot ? ARCHETYPES[bot.archetype] : null;
                    return (
                      <div
                        key={slotLabel}
                        className={`relative overflow-hidden rounded-xl border p-3 ${
                          bot
                            ? "border-cyan-100/20 bg-slate-900/70"
                            : "border-white/10 bg-slate-950/45"
                        }`}
                      >
                        {bot && <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${a?.aura}`} />}
                        <div className="relative flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-slate-950/80">
                            {bot ? <UnitPortrait src={bot.avatar} alt={bot.name} /> : <span className="text-cyan-100/60">◌</span>}
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Slot {slotLabel}</p>
                            <p className="text-sm font-semibold text-white">{bot ? `[${bot.callsign}]` : "Unassigned"}</p>
                            <p className="text-[11px] text-slate-300">
                              {bot ? `${bot.name} · ${a?.label} · Tier ${bot.tier}` : "Recruit or select a unit"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  {tacticalCells.map((cell) => (
                    <motion.div
                      key={cell.id}
                      animate={
                        cell.focused
                          ? { boxShadow: ["0 0 0 rgba(34,211,238,0)", "0 0 14px rgba(34,211,238,0.28)", "0 0 0 rgba(34,211,238,0)"] }
                          : undefined
                      }
                      transition={{ duration: 2.4, repeat: Infinity }}
                      className={`relative h-10 overflow-hidden rounded-md border ${
                        cell.focused
                          ? "border-cyan-300/35 bg-gradient-to-br from-cyan-400/12 via-slate-950/65 to-indigo-500/10"
                          : "border-cyan-100/10 bg-gradient-to-br from-cyan-400/8 via-slate-950/65 to-blue-500/8"
                      }`}
                    >
                      <p className="absolute right-1.5 top-1 text-[9px] font-medium tracking-[0.14em] text-cyan-100/75">
                        {String.fromCharCode(65 + cell.row)}{cell.col + 1}
                      </p>
                      {cell.linked && (
                        <p className="absolute bottom-1 left-1.5 truncate text-[9px] font-semibold tracking-[0.1em] text-cyan-50">
                          [{cell.linked.callsign}]
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
                  {selected && (
                    <div className="mt-2 h-20 w-full overflow-hidden rounded-xl border border-white/15 bg-slate-950/75">
                      <UnitPortrait src={selected.avatar} alt={selected.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <p className="mt-2 text-xl font-semibold text-white">{selected ? `[${selected.callsign}]` : "-"}</p>
                  <p className="mt-1 text-xs text-slate-300">{selected ? `${selected.name} · ${ARCHETYPES[selected.archetype].label} · Tier ${selected.tier}` : "-"}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {selected?.provider} · {selected?.model}
                  </p>
                </div>
                <div className="grid gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-cyan-100/10 bg-slate-950/55 px-3 py-2.5 text-xs text-slate-200">
                    <CheckCircle2 size={14} className="text-emerald-300" />
                    Command integrity: {health}%
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
          <Card title="Units" value={`${bots.length}`} sub={`${bots.filter((b) => b.enabled).length} active`} />
          <Card title="Health" value={`${health}%`} sub="Control plane availability" />
          <Card title="Loadout" value={`${loadoutUnits.length}/4`} sub="Squad slots occupied" />
          <Card title="Gateway" value="Bound" sub="/api/gateway-action wired" />
        </section>

        <section className={`${panelShell} lg:col-span-8 p-5 md:p-6`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(56,189,248,0.06)_0%,transparent_45%,rgba(99,102,241,0.05)_100%)]" />
          <div className="relative">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-white">Roster Bay</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setRecruitDraft((prev) => ({
                      ...prev,
                      callsign: prev.callsign || nextAvailableCallsign(prev.archetype, bots),
                    }));
                    setShowRecruitMenu(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/35 bg-gradient-to-r from-cyan-300 to-sky-300 px-3.5 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_20px_-12px_rgba(103,232,249,0.85)] transition hover:brightness-110"
                >
                  <Swords size={14} /> Recruit Menu
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
                {selectedCount > 0 ? "Formation override armed" : "Select units to unlock formation actions"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {bots.map((b) => {
                const batchSelected = selectedBots.includes(b.id);
                const a = ARCHETYPES[b.archetype];

                return (
                  <motion.div
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.18 }}
                    key={b.id}
                    className={`relative overflow-hidden rounded-2xl border p-4 backdrop-blur-xl transition ${
                      selectedId === b.id
                        ? "border-cyan-200/35 bg-gradient-to-br from-cyan-400/10 via-slate-900/72 to-indigo-500/10 shadow-[0_0_26px_-16px_rgba(34,211,238,0.7)]"
                        : "border-white/10 bg-slate-950/50 hover:border-cyan-100/25 hover:bg-slate-900/70"
                    } ${batchSelected ? "ring-1 ring-violet-300/35" : ""}`}
                  >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${a.aura}`} />
                    <div className="relative mb-3 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={batchSelected}
                          onChange={() => toggleBotSelection(b.id)}
                          className="mt-1 h-4 w-4 rounded border-cyan-200/35 bg-slate-900 text-cyan-300"
                        />
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-slate-950/75">
                          <UnitPortrait src={b.avatar} alt={b.name} />
                        </div>
                        <button className="text-left" onClick={() => setSelectedId(b.id)}>
                          <p className="text-base font-semibold text-white">[{b.callsign}]</p>
                          <p className="mt-0.5 text-xs text-slate-300">{b.name} · {a.label}</p>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {batchSelected && (
                          <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-violet-100">
                            grouped
                          </span>
                        )}
                        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${a.chip}`}>
                          Tier {b.tier}
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

                    <div className="relative mb-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                      <span className={`rounded-md border px-2 py-0.5 ${a.chip}`}>{a.role}</span>
                      <span>·</span>
                      <span>
                        {b.provider} · {b.model}
                      </span>
                    </div>

                    <div className="relative flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setSelectedId(b.id);
                          setShowConfig(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-100/18 bg-slate-900/45 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-cyan-200/35 hover:bg-cyan-300/8"
                      >
                        <Settings size={13} /> Loadout
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
                <Shield size={16} /> Open Loadout Panel
              </button>
            </div>
            <p className="mt-4 rounded-lg border border-cyan-100/10 bg-slate-900/55 px-3 py-2 text-xs text-slate-300">
              {gatewayMsg || "Gateway ready"}
            </p>
          </div>
        </section>
      </div>

      {showRecruitMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-4 backdrop-blur-sm md:items-center">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/12 bg-slate-950/92 p-5 shadow-[0_24px_80px_-40px_rgba(34,211,238,0.68)] backdrop-blur-2xl md:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(56,189,248,0.07)_0%,transparent_42%,rgba(99,102,241,0.08)_100%)]" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-white">Recruit Menu</h3>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Choose archetype, tier, and operational profile</p>
                </div>
                <button
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/8 hover:text-white"
                  onClick={() => setShowRecruitMenu(false)}
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(ARCHETYPES) as BotArchetype[]).map((key) => {
                  const a = ARCHETYPES[key];
                  const active = recruitDraft.archetype === key;
                  return (
                    <button
                      key={key}
                      onClick={() =>
                        setRecruitDraft((prev) => ({
                          ...prev,
                          archetype: key,
                          callsign: prev.callsign || nextAvailableCallsign(key, bots),
                        }))
                      }
                      className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                        active
                          ? "border-cyan-300/45 bg-slate-900/80 shadow-[0_0_20px_-14px_rgba(34,211,238,0.9)]"
                          : "border-white/10 bg-slate-900/45 hover:border-cyan-200/30"
                      }`}
                    >
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${a.aura}`} />
                      <div className="relative">
                        <div className="h-24 w-full overflow-hidden rounded-xl border border-white/15 bg-slate-950/70">
                          <UnitPortrait src={a.avatar} alt={a.label} className="h-full w-full object-cover" />
                        </div>
                        <p className={`mt-2 text-base font-semibold ${a.tone}`}>{a.label}</p>
                        <p className="mt-1 text-xs text-slate-300">{a.role}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field
                  label="Callsign"
                  value={recruitDraft.callsign}
                  onChange={(v) => setRecruitDraft((p) => ({ ...p, callsign: normalizeCallsign(v) }))}
                />
                <Field label="Operator Name" value={recruitDraft.name} onChange={(v) => setRecruitDraft((p) => ({ ...p, name: v }))} />
                <SelectField
                  label="Tier"
                  value={recruitDraft.tier}
                  options={["I", "II", "III"]}
                  onChange={(v) => setRecruitDraft((p) => ({ ...p, tier: v as BotTier }))}
                />
                <SelectField
                  label="Provider"
                  value={recruitDraft.provider}
                  options={["openai-codex", "google-gemini-cli"]}
                  onChange={(v) => setRecruitDraft((p) => ({ ...p, provider: v as BotConfig["provider"] }))}
                />
                <Field label="Model" value={recruitDraft.model} onChange={(v) => setRecruitDraft((p) => ({ ...p, model: v }))} />
                <SelectField
                  label="Thinking"
                  value={recruitDraft.thinking}
                  options={["low", "medium", "high"]}
                  onChange={(v) => setRecruitDraft((p) => ({ ...p, thinking: v as BotConfig["thinking"] }))}
                />
                <SelectField
                  label="Priority"
                  value={recruitDraft.priority}
                  options={["low", "med", "high"]}
                  onChange={(v) => setRecruitDraft((p) => ({ ...p, priority: v as BotConfig["priority"] }))}
                />
                <Field
                  label="Schedule"
                  value={recruitDraft.schedule}
                  onChange={(v) => setRecruitDraft((p) => ({ ...p, schedule: v }))}
                />
                <Field
                  label="Channel"
                  value={recruitDraft.channel}
                  onChange={(v) => setRecruitDraft((p) => ({ ...p, channel: v }))}
                />
                <div className="md:col-span-2">
                  <Field
                    label="Allowed Tools"
                    value={recruitDraft.allowedTools}
                    onChange={(v) => setRecruitDraft((p) => ({ ...p, allowedTools: v }))}
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={recruitBot}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/35 bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-2 font-semibold text-slate-950 shadow-[0_0_20px_-12px_rgba(103,232,249,0.85)] transition hover:brightness-110"
                >
                  <Swords size={14} /> Recruit Unit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfig && selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-4 backdrop-blur-sm md:items-center">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/12 bg-slate-950/90 p-5 shadow-[0_24px_80px_-40px_rgba(34,211,238,0.68)] backdrop-blur-2xl md:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(56,189,248,0.07)_0%,transparent_42%,rgba(99,102,241,0.08)_100%)]" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-semibold tracking-tight text-white">Loadout · [{selected.callsign}]</h3>
                <button
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/8 hover:text-white"
                  onClick={() => setShowConfig(false)}
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Callsign" value={selected.callsign} onChange={(v) => updateBot({ callsign: v })} />
                <Field label="Operator Name" value={selected.name} onChange={(v) => updateBot({ name: v })} />
                <SelectField
                  label="Archetype"
                  value={selected.archetype}
                  options={["sentinel", "sniper", "analyst", "medic"]}
                  onChange={(v) => updateBot({ archetype: v as BotArchetype })}
                />
                <SelectField label="Tier" value={selected.tier} options={["I", "II", "III"]} onChange={(v) => updateBot({ tier: v as BotTier })} />
                <Field label="Model" value={selected.model} onChange={(v) => updateBot({ model: v })} />
                <SelectField
                  label="Provider"
                  value={selected.provider}
                  options={["openai-codex", "google-gemini-cli"]}
                  onChange={(v) => updateBot({ provider: v as BotConfig["provider"] })}
                />
                <SelectField
                  label="Thinking"
                  value={selected.thinking}
                  options={["low", "medium", "high"]}
                  onChange={(v) => updateBot({ thinking: v as BotConfig["thinking"] })}
                />
                <SelectField
                  label="Priority"
                  value={selected.priority}
                  options={["low", "med", "high"]}
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
                  <Save size={14} /> Save Loadout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function UnitPortrait({ src, alt, className = "h-full w-full object-cover" }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} className={className} draggable={false} />;
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

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-[11px] font-medium uppercase tracking-[0.2em] text-slate-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-white/12 bg-slate-900/70 px-3.5 py-2.5 text-sm normal-case tracking-normal text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition focus:border-cyan-300/45 focus:bg-slate-900 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.1)]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
