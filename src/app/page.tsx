"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, Line, Clone, Text, useGLTF, useTexture } from "@react-three/drei";
import { Group, MeshBasicMaterial, MeshStandardMaterial, SpriteMaterial, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
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
  Radar,
  Swords,
  Shield,
  ZoomIn,
  ZoomOut,
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
  squadId?: string;
  projectTag?: string;
  characterIndex?: number;
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
  squadId: string;
  projectTag: string;
};

const STORAGE_KEY = "opsnode.bots.v1";
const VERSIONS_KEY = "opsnode.bots.versions.v1";

const SPRITE_SHEET = "/assets/characters/kenney-mini-characters-preview.png";
const SPRITE_GRID = { cols: 9, rows: 5 }; // Based on 918x515

const ARCHETYPES: Record<
  BotArchetype,
  {
    label: string;
    role: string;
    avatar: string;
    worldTexture: string;
    worldScale: [number, number, number];
    aura: string;
    chip: string;
    tone: string;
    accent: string;
    trim: string;
    emissive: string;
  }
> = {
  sentinel: {
    label: "Sentinel",
    role: "Frontline defense",
    avatar: "/assets/characters/sentinel-card.png",
    worldTexture: SPRITE_SHEET,
    worldScale: [0.36, 0.36, 1],
    aura: "from-blue-300/18 via-sky-300/8 to-transparent",
    chip: "border-blue-200/28 bg-blue-400/12 text-blue-100",
    tone: "text-blue-200",
    accent: "#8fb8ff",
    trim: "#8a909a",
    emissive: "#375a9a",
  },
  sniper: {
    label: "Sniper",
    role: "Precision strike",
    avatar: "/assets/characters/sniper-card.png",
    worldTexture: SPRITE_SHEET,
    worldScale: [0.36, 0.36, 1],
    aura: "from-violet-300/18 via-indigo-300/8 to-transparent",
    chip: "border-violet-200/28 bg-violet-400/12 text-violet-100",
    tone: "text-violet-200",
    accent: "#bca8f0",
    trim: "#8a8580",
    emissive: "#5d4a8f",
  },
  analyst: {
    label: "Analyst",
    role: "Intel & planning",
    avatar: "/assets/characters/analyst-card.png",
    worldTexture: SPRITE_SHEET,
    worldScale: [0.36, 0.36, 1],
    aura: "from-cyan-200/16 via-slate-300/8 to-transparent",
    chip: "border-cyan-100/28 bg-cyan-300/10 text-cyan-50",
    tone: "text-cyan-100",
    accent: "#90b2d8",
    trim: "#7d8693",
    emissive: "#436384",
  },
  medic: {
    label: "Medic",
    role: "Recovery support",
    avatar: "/assets/characters/medic-card.png",
    worldTexture: SPRITE_SHEET,
    worldScale: [0.36, 0.36, 1],
    aura: "from-teal-300/18 via-emerald-300/8 to-transparent",
    chip: "border-teal-200/28 bg-teal-400/12 text-teal-100",
    tone: "text-teal-200",
    accent: "#8cbcab",
    trim: "#7f8a84",
    emissive: "#2f6f5b",
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
    squadId: "alpha",
    projectTag: "NEXUS",
    characterIndex: 12,
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
    squadId: "alpha",
    projectTag: "NEXUS",
    characterIndex: 4,
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
  squadId: "auto",
  projectTag: "",
};

function resolveAvatar(_avatar: string | undefined, archetype: BotArchetype) {
  return ARCHETYPES[archetype].avatar;
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

const STATUS_STYLE: Record<BotConfig["status"], { color: string; accent: string; glow: string }> = {
  idle: { color: "#94a3b8", accent: "#cbd5e1", glow: "rgba(148, 163, 184, 0.5)" },
  running: { color: "#22c55e", accent: "#86efac", glow: "rgba(34, 197, 94, 0.6)" },
  paused: { color: "#f59e0b", accent: "#fcd34d", glow: "rgba(245, 158, 11, 0.6)" },
};

const SQUAD_SIZE = 8;

type SquadDefinition = {
  id: string;
  name: string;
  projectTag: string;
  color: string;
};

const SQUADS: SquadDefinition[] = [
  { id: "alpha", name: "Squad Alpha", projectTag: "NEXUS", color: "#67e8f9" },
  { id: "bravo", name: "Squad Bravo", projectTag: "ORBIT", color: "#a5b4fc" },
  { id: "charlie", name: "Squad Charlie", projectTag: "AURORA", color: "#6ee7b7" },
];

const DESK_SLOT_COUNT = SQUADS.length * SQUAD_SIZE;
const MIN_CAMERA_DISTANCE = 3.2;
const MAX_CAMERA_DISTANCE = 7.4;
const DEFAULT_CAMERA_DISTANCE = 4.6;

function normalizeProjectTag(v: string | undefined) {
  const normalized = (v || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 18);
  return normalized;
}

function squadIndexById(id: string | undefined) {
  const index = SQUADS.findIndex((s) => s.id === id);
  return index >= 0 ? index : 0;
}

function squadForSlot(slot: number | undefined) {
  if (!Number.isInteger(slot)) return null;
  const index = Math.floor((slot as number) / SQUAD_SIZE);
  return SQUADS[index] ?? null;
}

function laneCenterZ(index: number) {
  return index * 2.4 - 2.4;
}

function squadSeatSlot(squadId: string, seat: number) {
  const base = squadIndexById(squadId) * SQUAD_SIZE;
  return base + seat;
}

function firstFreeSlotInSquad(existing: BotConfig[], squadId: string) {
  const used = new Set(existing.map((b) => b.deskSlot).filter((slot): slot is number => Number.isInteger(slot)));
  for (let seat = 0; seat < SQUAD_SIZE; seat += 1) {
    const slot = squadSeatSlot(squadId, seat);
    if (!used.has(slot)) return slot;
  }
  return null;
}

function firstSquadWithSpace(existing: BotConfig[]) {
  for (const squad of SQUADS) {
    if (firstFreeSlotInSquad(existing, squad.id) !== null) return squad;
  }
  return SQUADS[0];
}

function assignDeskSlots(list: BotConfig[]) {
  const used = new Set<number>();
  return list.map((bot, i) => {
    const inferredSquad = bot.squadId && SQUADS.some((s) => s.id === bot.squadId) ? bot.squadId : squadForSlot(bot.deskSlot)?.id;
    let squadId = inferredSquad ?? SQUADS[0].id;

    const raw = bot.deskSlot;
    const validWithinSquad =
      Number.isInteger(raw) &&
      (raw as number) >= 0 &&
      (raw as number) < DESK_SLOT_COUNT &&
      !used.has(raw as number) &&
      squadForSlot(raw as number)?.id === squadId;

    let deskSlot = validWithinSquad ? (raw as number) : -1;

    if (deskSlot < 0) {
      for (let seat = 0; seat < SQUAD_SIZE; seat += 1) {
        const candidate = squadSeatSlot(squadId, seat);
        if (!used.has(candidate)) {
          deskSlot = candidate;
          break;
        }
      }
    }

    if (deskSlot < 0) {
      for (let slot = 0; slot < DESK_SLOT_COUNT; slot += 1) {
        if (!used.has(slot)) {
          deskSlot = slot;
          squadId = squadForSlot(slot)?.id ?? squadId;
          break;
        }
      }
    }

    if (deskSlot < 0) {
      deskSlot = i % DESK_SLOT_COUNT;
      squadId = squadForSlot(deskSlot)?.id ?? squadId;
    }

    used.add(deskSlot);
    const squadMeta = SQUADS.find((s) => s.id === squadId) ?? SQUADS[0];

    return {
      ...bot,
      deskSlot,
      squadId,
      projectTag: normalizeProjectTag(bot.projectTag) || squadMeta.projectTag,
    };
  });
}

function unitSlotPosition(i: number): Vec3 {
  const lane = Math.floor(i / SQUAD_SIZE);
  const seat = i % SQUAD_SIZE;
  const row = Math.floor(seat / 4);
  const col = seat % 4;
  const x = (col - 1.5) * 1.1;
  const z = laneCenterZ(lane) + (row - 0.5) * 1.1;
  return [x, 0.09, z];
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

function SceneEnvironment({
  onClearSelection,
  squadById,
}: {
  onClearSelection: () => void;
  squadById: Map<string, SquadDefinition>;
}) {
  const inlayRun: Vec3[] = [
    [-3.85, 0.01, 3.68],
    [-1.95, 0.01, 2.36],
    [0, 0.01, 1.22],
    [1.95, 0.01, 2.36],
    [3.85, 0.01, 3.68],
  ];

  const desk = useGLTF("/assets/office/desk.glb");
  const deskCorner = useGLTF("/assets/office/desk_corner.glb");
  const deskChair = useGLTF("/assets/office/desk_chair.glb");
  const paneling = useGLTF("/assets/office/paneling.glb");
  const wallWindow = useGLTF("/assets/office/wall_window.glb");
  const computerScreen = useGLTF("/assets/office/computer_screen.glb");
  const lampCeiling = useGLTF("/assets/office/lamp_ceiling.glb");

  return (
    <>
      <color attach="background" args={["#010204"]} />
      <ambientLight intensity={0.15} color="#d1eaff" />
      <directionalLight position={[5, 8, 5]} intensity={1.4} color="#ffffff" />
      <directionalLight position={[-5, 4, -2]} intensity={0.6} color="#7dd3fc" />
      <pointLight position={[0, 4, 0]} intensity={1.2} color="#0ea5e9" />
      <spotLight position={[0, 6, 0]} angle={0.4} penumbra={1} intensity={2} color="#22d3ee" castShadow />

      {/* Main Floor Plate */}
      <mesh position={[0, -0.585, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onClearSelection}>
        <planeGeometry args={[20, 16]} />
        <meshStandardMaterial color="#020408" roughness={1} metalness={0} />
      </mesh>

      {/* Premium Glass Floor */}
      <mesh position={[0, -0.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 10]} />
        <meshStandardMaterial color="#0a0f1d" roughness={0.05} metalness={0.9} envMapIntensity={1} />
      </mesh>

      {/* Grid Pattern */}
      <gridHelper args={[12, 12, "#1e293b", "#0f172a"]} position={[0, -0.575, 0]} />

      {SQUADS.map((baseSquad, lane) => {
        const squad = squadById.get(baseSquad.id) ?? baseSquad;
        const z = laneCenterZ(lane);
        return (
          <group key={squad.id}>
            {/* Squad Boundary Floor Plate */}
            <mesh position={[0, -0.57, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[5.2, 2]} />
              <meshStandardMaterial color={squad.color} transparent opacity={0.12} roughness={0.1} metalness={0.8} />
            </mesh>
            
            {/* Holographic Border */}
            <mesh position={[0, -0.569, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[2.58, 2.62, 64]} />
              <meshBasicMaterial color={squad.color} transparent opacity={0.4} />
            </mesh>

            {/* Glowing Corner Accents */}
            {[[-2.6, -1], [-2.6, 1], [2.6, -1], [2.6, 1]].map(([x, dz], i) => (
              <mesh key={i} position={[x, -0.565, z + dz]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.2, 0.02]} />
                <meshBasicMaterial color={squad.color} transparent opacity={0.8} />
              </mesh>
            ))}

            <Text
              position={[-3.4, 0.15, z]}
              rotation={[0, Math.PI / 2, 0]}
              fontSize={0.22}
              color={squad.color}
              font="/fonts/Inter-Bold.otf"
              anchorX="center"
              anchorY="middle"
              maxWidth={1}
            >
              {`${squad.name.toUpperCase()}\n${squad.projectTag}`}
            </Text>
          </group>
        );
      })}

      <group position={[0, -0.55, -4.35]} scale={[8.4, 4.4, 1]}>
        <Clone object={paneling.scene} />
      </group>
      <group position={[-3.95, -0.55, -4.3]} scale={[3.8, 4.4, 1]}>
        <Clone object={wallWindow.scene} />
      </group>
      <group position={[3.95, -0.55, -4.3]} scale={[3.8, 4.4, 1]}>
        <Clone object={wallWindow.scene} />
      </group>

      <group position={[0, -0.49, -1.24]} scale={[1.5, 1.5, 1.5]}>
        <Clone object={deskCorner.scene} />
      </group>

      {Array.from({ length: DESK_SLOT_COUNT }).map((_, i) => {
        const [x, y, z] = unitSlotPosition(i);
        const lane = Math.floor(i / SQUAD_SIZE);
        const squad = SQUADS[lane];
        const squadColor = squadById.get(squad.id)?.color ?? squad.color;
        return (
          <group key={`desk-slot-${i}`} position={[x, y - 0.066, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.2, 0.24, 32]} />
              <meshBasicMaterial color={squadColor} transparent opacity={0.4} />
            </mesh>
            <mesh position={[0, -0.006, 0]}>
              <cylinderGeometry args={[0.18, 0.18, 0.02, 24]} />
              <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.5} />
            </mesh>
            <group position={[0, -0.012, -0.12]} scale={[0.55, 0.55, 0.55]}>
              <Clone object={desk.scene} />
            </group>
            <group position={[0, -0.012, 0.2]} rotation={[0, Math.PI, 0]} scale={[0.42, 0.42, 0.42]}>
              <Clone object={deskChair.scene} />
            </group>
          </group>
        );
      })}

      {[-2, -0.6, 0.6, 2].map((x, i) => (
        <group key={i} position={[x, 0.5, -1.8]} scale={[0.6, 0.6, 0.6]}>
          <Clone object={computerScreen.scene} />
        </group>
      ))}

      {[-2.5, -0.8, 0.8, 2.5].map((x, i) => (
        <group key={`lamp-${i}`} position={[x, 2.5, -1.2]} scale={[1, 1, 1]}>
          <Clone object={lampCeiling.scene} />
        </group>
      ))}

      <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.2}>
        <mesh position={[0, 2.8, -1]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.8, 0.02, 16, 100]} />
          <meshStandardMaterial color="#0ea5e9" emissive="#38bdf8" emissiveIntensity={1} roughness={0.1} metalness={1} />
        </mesh>
      </Float>

      <Line points={inlayRun} color="#38bdf8" lineWidth={2} transparent opacity={0.3} />
    </>
  );
}

useGLTF.preload("/assets/office/desk.glb");
useGLTF.preload("/assets/office/desk_corner.glb");
useGLTF.preload("/assets/office/desk_chair.glb");
useGLTF.preload("/assets/office/paneling.glb");
useGLTF.preload("/assets/office/wall_window.glb");
useGLTF.preload("/assets/office/computer_screen.glb");
useGLTF.preload("/assets/office/lamp_ceiling.glb");
Object.values(ARCHETYPES).forEach((archetype) => {
  useTexture.preload(archetype.worldTexture);
});

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
  const statusIconRef = useRef<Group>(null);
  const panelMatRef = useRef<MeshStandardMaterial>(null);
  const portraitMatRef = useRef<SpriteMaterial>(null);
  const spawnGlowMatRef = useRef<MeshBasicMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const spawnProgressRef = useRef(shouldSpawn ? 0 : 1);
  const style = ARCHETYPES[bot.archetype];
  const statusStyle = STATUS_STYLE[bot.status];
  
  // Unique character mapping via texture offset
  const portraitTexture = useTexture(style.worldTexture);
  const charIdx = bot.characterIndex ?? 0;
  const col = charIdx % SPRITE_GRID.cols;
  const row = Math.floor(charIdx / SPRITE_GRID.cols);
  
  const spriteTexture = useMemo(() => {
    const tex = portraitTexture.clone();
    tex.repeat.set(1 / SPRITE_GRID.cols, 1 / SPRITE_GRID.rows);
    tex.offset.set(col / SPRITE_GRID.cols, 1 - (row + 1) / SPRITE_GRID.rows);
    tex.needsUpdate = true;
    return tex;
  }, [portraitTexture, col, row]);

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

    if (panelMatRef.current) {
      panelMatRef.current.opacity = Math.min(0.95, visibleOpacity * 0.95);
      panelMatRef.current.emissiveIntensity = (selected ? 0.45 : 0.2) + glowIntensity * 0.35;
    }
    if (portraitMatRef.current) {
      portraitMatRef.current.opacity = visibleOpacity;
    }
    if (spawnGlowMatRef.current) {
      spawnGlowMatRef.current.opacity = glowIntensity;
    }
    if (statusIconRef.current && bot.status === "running") {
      statusIconRef.current.rotation.z = t * 2.5;
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
      <mesh position={[0, -0.035, 0]}>
        <cylinderGeometry args={[0.2, 0.26, 0.055, 24]} />
        <meshStandardMaterial color="#101828" roughness={0.9} metalness={0.14} />
      </mesh>

      <mesh position={[0, 0.16, -0.01]}>
        <boxGeometry args={[0.24, 0.34, 0.04]} />
        <meshStandardMaterial
          ref={panelMatRef}
          transparent
          color={style.trim}
          emissive={style.emissive}
          emissiveIntensity={selected ? 0.34 : 0.18}
          roughness={0.34}
          metalness={0.5}
        />
      </mesh>

      <sprite position={[0, 0.18, 0.02]} scale={style.worldScale}>
        <spriteMaterial ref={portraitMatRef} map={spriteTexture} transparent depthWrite={false} />
      </sprite>

      <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.17, 0.29, 32]} />
        <meshBasicMaterial ref={spawnGlowMatRef} color={style.accent} transparent opacity={0} />
      </mesh>

      <group position={[0, 0.5, 0]}>
        <mesh>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshStandardMaterial color={statusStyle.color} emissive={statusStyle.color} emissiveIntensity={selected ? 2 : 1.2} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.06, 0.08, 32]} />
          <meshBasicMaterial color={statusStyle.color} transparent opacity={0.6} />
        </mesh>
        {bot.status === "running" && (
          <group ref={statusIconRef}>
            <mesh position={[0.1, 0, 0]}>
              <boxGeometry args={[0.02, 0.08, 0.01]} />
              <meshStandardMaterial color={statusStyle.accent} emissive={statusStyle.accent} emissiveIntensity={0.5} />
            </mesh>
          </group>
        )}
        {bot.status === "paused" && (
          <group position={[0.1, 0, 0]}>
            <mesh position={[-0.015, 0, 0]}>
              <boxGeometry args={[0.012, 0.06, 0.012]} />
              <meshStandardMaterial color={statusStyle.accent} />
            </mesh>
            <mesh position={[0.015, 0, 0]}>
              <boxGeometry args={[0.012, 0.06, 0.012]} />
              <meshStandardMaterial color={statusStyle.accent} />
            </mesh>
          </group>
        )}
        {bot.status === "idle" && (
          <mesh position={[0.1, 0, 0]}>
            <torusGeometry args={[0.025, 0.008, 12, 24]} />
            <meshStandardMaterial color={statusStyle.accent} emissive={statusStyle.accent} emissiveIntensity={0.4} />
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
  zoomTarget,
  onZoomDistance,
}: {
  bots: BotConfig[];
  selectedBots: string[];
  onUnitSelect: (id: string, additive: boolean) => void;
  onClearSelection: () => void;
  spawnedBotIds: string[];
  zoomTarget: number;
  onZoomDistance: (distance: number) => void;
}) {
  const squad = useMemo(
    () => [...bots].sort((a, b) => (a.deskSlot ?? Number.MAX_SAFE_INTEGER) - (b.deskSlot ?? Number.MAX_SAFE_INTEGER)).slice(0, DESK_SLOT_COUNT),
    [bots],
  );
  const selectedSet = useMemo(() => new Set(selectedBots), [selectedBots]);
  const spawnedSet = useMemo(() => new Set(spawnedBotIds), [spawnedBotIds]);
  const grouped = selectedBots.length > 1;
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const distanceRef = useRef<number>(DEFAULT_CAMERA_DISTANCE);

  const formationMap = useMemo(() => {
    const map = new Map<string, Vec3>();
    selectedBots.forEach((id, i) => map.set(id, formationSlot(i)));
    return map;
  }, [selectedBots]);

  const squadById = useMemo(() => {
    const map = new Map<string, SquadDefinition>();
    SQUADS.forEach((s) => map.set(s.id, s));
    bots.forEach((bot) => {
      const squadId = bot.squadId;
      if (!squadId) return;
      const base = map.get(squadId);
      if (!base) return;
      const projectTag = normalizeProjectTag(bot.projectTag) || base.projectTag;
      map.set(squadId, { ...base, projectTag });
    });
    return map;
  }, [bots]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const nextDistance = Math.min(MAX_CAMERA_DISTANCE, Math.max(MIN_CAMERA_DISTANCE, zoomTarget));
    const camera = controls.object;
    const offset = camera.position.clone().sub(controls.target);
    if (offset.lengthSq() < 1e-6) offset.copy(new Vector3(0, 0.42, nextDistance));
    offset.setLength(nextDistance);
    camera.position.copy(controls.target.clone().add(offset));
    controls.update();
  }, [zoomTarget]);

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const distance = controls.object.position.distanceTo(controls.target);
    if (Math.abs(distance - distanceRef.current) > 0.02) {
      distanceRef.current = distance;
      onZoomDistance(distance);
    }

    const lerp = 1 - Math.exp(-4 * delta);
    if (selectedBots.length === 1) {
      const bot = bots.find((b) => b.id === selectedBots[0]);
      if (bot) {
        const [tx, ty, tz] = unitSlotPosition(bot.deskSlot ?? 0);
        controls.target.x += (tx - controls.target.x) * lerp;
        controls.target.y += (ty + 0.3 - controls.target.y) * lerp;
        controls.target.z += (tz - controls.target.z) * lerp;
      }
    } else {
      controls.target.x += (0 - controls.target.x) * lerp;
      controls.target.y += (0 - controls.target.y) * lerp;
      controls.target.z += (0 - controls.target.z) * lerp;
    }
    controls.update();
  });

  return (
    <>
      <SceneEnvironment onClearSelection={onClearSelection} squadById={squadById} />
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
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom
        zoomSpeed={0.65}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        autoRotate
        autoRotateSpeed={0.16}
        maxDistance={MAX_CAMERA_DISTANCE}
        minDistance={MIN_CAMERA_DISTANCE}
        maxPolarAngle={Math.PI / 2.05}
        minPolarAngle={Math.PI / 2.9}
      />
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

      // Stable character mapping based on index or existing characterIndex
      let characterIndex = typeof b.characterIndex === "number" ? b.characterIndex : -1;
      if (characterIndex < 0) {
        // Find a character index not yet used by hydrated bots
        const usedChars = new Set(hydrated.map(h => h.characterIndex));
        for (let c = 0; c < SPRITE_GRID.cols * SPRITE_GRID.rows; c++) {
          if (!usedChars.has(c)) {
            characterIndex = c;
            break;
          }
        }
        if (characterIndex < 0) characterIndex = hydrated.length % (SPRITE_GRID.cols * SPRITE_GRID.rows);
      }

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
        squadId:
          (typeof b.squadId === "string" && SQUADS.some((s) => s.id === b.squadId)
            ? b.squadId
            : typeof fallback.squadId === "string"
              ? fallback.squadId
              : squadForSlot(Number.isInteger(b.deskSlot) ? (b.deskSlot as number) : fallback.deskSlot)?.id) ?? SQUADS[0].id,
        projectTag: normalizeProjectTag(typeof b.projectTag === "string" ? b.projectTag : undefined),
        characterIndex,
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

function recruitPlacement(existing: BotConfig[], preferredSquad: string) {
  const preferredValid = SQUADS.some((s) => s.id === preferredSquad);
  const squad = preferredValid ? SQUADS.find((s) => s.id === preferredSquad)! : firstSquadWithSpace(existing);
  const preferredSlot = firstFreeSlotInSquad(existing, squad.id);

  if (preferredSlot !== null) {
    return {
      squad,
      deskSlot: preferredSlot,
      autoRerouted: false,
    };
  }

  const fallbackSquad = firstSquadWithSpace(existing);
  const fallbackSlot = firstFreeSlotInSquad(existing, fallbackSquad.id);
  if (fallbackSlot !== null) {
    return {
      squad: fallbackSquad,
      deskSlot: fallbackSlot,
      autoRerouted: fallbackSquad.id !== squad.id,
    };
  }

  const deskSlot = existing.length % DESK_SLOT_COUNT;
  const overflowSquad = squadForSlot(deskSlot) ?? SQUADS[0];
  return {
    squad: overflowSquad,
    deskSlot,
    autoRerouted: overflowSquad.id !== squad.id,
  };
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
  const [cameraDistance, setCameraDistance] = useState(DEFAULT_CAMERA_DISTANCE);
  const [cameraDistanceTarget, setCameraDistanceTarget] = useState(DEFAULT_CAMERA_DISTANCE);

  useEffect(() => {
    const loaded = loadBots();
    setBots(loaded);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
  }, []);

  const selected = useMemo(() => bots.find((b) => b.id === selectedId) || bots[0], [bots, selectedId]);
  const selectedCount = selectedBots.length;

  const squadsView = useMemo(() => {
    return SQUADS.map((squad) => {
      const members = bots
        .filter((b) => b.squadId === squad.id)
        .sort((a, b) => (a.deskSlot ?? Number.MAX_SAFE_INTEGER) - (b.deskSlot ?? Number.MAX_SAFE_INTEGER));
      const projectTag = members[0]?.projectTag || squad.projectTag;
      return { ...squad, projectTag, members };
    });
  }, [bots]);

  const selectedBotUnits = useMemo(() => bots.filter((b) => selectedBots.includes(b.id)), [bots, selectedBots]);

  const loadoutUnits = useMemo(() => {
    if (selectedBotUnits.length) return selectedBotUnits.slice(0, 4);
    return bots.filter((b) => b.enabled).slice(0, 4);
  }, [bots, selectedBotUnits]);

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
    const preferredSquad = recruitDraft.squadId === "auto" ? firstSquadWithSpace(bots).id : recruitDraft.squadId;
    const placement = recruitPlacement(bots, preferredSquad);
    const projectTag = normalizeProjectTag(recruitDraft.projectTag) || placement.squad.projectTag;

    const usedChars = new Set(bots.map(b => b.characterIndex));
    let characterIndex = -1;
    for (let c = 0; c < SPRITE_GRID.cols * SPRITE_GRID.rows; c++) {
      if (!usedChars.has(c)) {
        characterIndex = c;
        break;
      }
    }
    if (characterIndex < 0) characterIndex = bots.length % (SPRITE_GRID.cols * SPRITE_GRID.rows);

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
        deskSlot: placement.deskSlot,
        squadId: placement.squad.id,
        projectTag,
        characterIndex,
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
    setGatewayMsg(
      `Recruited [${callsign}] ${next[next.length - 1].name} · ${placement.squad.name} / ${projectTag}${placement.autoRerouted ? " (auto-rerouted)" : ""}`,
    );
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
      if (typeof patch.projectTag === "string") {
        merged.projectTag = normalizeProjectTag(patch.projectTag) || merged.projectTag;
      }
      if (typeof patch.squadId === "string" && !SQUADS.some((s) => s.id === patch.squadId)) {
        merged.squadId = b.squadId;
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

  const enabledCount = useMemo(() => bots.filter((b) => b.enabled).length, [bots]);
  const runningCount = useMemo(() => bots.filter((b) => b.status === "running").length, [bots]);
  const pausedCount = useMemo(() => bots.filter((b) => b.status === "paused").length, [bots]);
  const idleCount = useMemo(() => bots.filter((b) => b.status === "idle").length, [bots]);
  const disabledCount = bots.length - enabledCount;

  const roleCounts = useMemo(
    () =>
      bots.reduce(
        (acc, bot) => {
          acc[bot.archetype] += 1;
          return acc;
        },
        { sentinel: 0, sniper: 0, analyst: 0, medic: 0 } as Record<BotArchetype, number>,
      ),
    [bots],
  );

  const missionQueue = useMemo(
    () => [
      `${runningCount} active execution nodes`,
      `${pausedCount} paused nodes awaiting resume`,
      `${idleCount} idle units ready for assignment`,
      `${selectedCount} units in selection scope`,
    ],
    [runningCount, pausedCount, idleCount, selectedCount],
  );

  const health = Math.round((enabledCount / Math.max(1, bots.length)) * 100);
  const missionState = runningCount > 0 ? "Engaged" : pausedCount > 0 ? "Holding" : "Standby";
  const zoomPercent = Math.round(((cameraDistance - MIN_CAMERA_DISTANCE) / (MAX_CAMERA_DISTANCE - MIN_CAMERA_DISTANCE)) * 100);
  const setDistanceTarget = (next: number) => {
    const clamped = Math.min(MAX_CAMERA_DISTANCE, Math.max(MIN_CAMERA_DISTANCE, Number(next.toFixed(2))));
    setCameraDistanceTarget(clamped);
  };

  const panelShell =
    "relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/40 backdrop-blur-3xl shadow-[0_0_80px_-20px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.05)]";
  const modeButton =
    "rounded-xl px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020408] px-4 py-8 font-sans text-slate-100 md:px-10 md:py-12 selection:bg-cyan-500/30">
      {/* Dynamic Background Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(34,211,238,0.12),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,4,8,0)_0%,rgba(2,4,8,0.9)_100%)]" />
        <div className="scanline" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent blur-sm animate-pulse-glow" />
      </div>

      <div className="relative mx-auto grid w-full max-w-[1600px] gap-8 lg:grid-cols-12">
        <header className="glass-panel lg:col-span-12 p-6 md:p-10 flex flex-wrap items-center justify-between gap-6 border-cyan-500/10 relative">
          {/* Header Accent Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
          
          <div className="relative">
            <div className="absolute -left-6 top-1/2 h-14 w-1 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.9)]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-cyan-400/70 hologram-glow">Neural Network Terminal</p>
            <h1 className="mt-2 text-4xl font-black tracking-tighter text-white md:text-6xl uppercase italic">
              OpsNode <span className="text-cyan-400 not-italic">V6</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-8">
            <div className="flex flex-col items-end">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">System Pulse</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="relative">
                  <span className="block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="absolute inset-0 h-full w-full rounded-full bg-emerald-400 animate-ping opacity-40" />
                </div>
                <span className="text-sm font-black text-emerald-400 uppercase tracking-widest">Active Integrity</span>
              </div>
            </div>
            <div className="hidden md:block h-12 w-[1px] bg-white/10" />
            <div className="flex flex-col items-end">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Nodes Synchronized</p>
              <p className="mt-1 text-2xl font-black text-white">{bots.length} / {DESK_SLOT_COUNT}</p>
            </div>
          </div>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel lg:col-span-8 p-1 sm:p-2 border-white/5 shadow-2xl overflow-hidden"
        >
          <div className="relative h-full flex flex-col">
            <div className="p-6 md:p-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/5 bg-white/2">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-[0.3em] text-white flex items-center gap-3">
                  <Radar className="w-5 h-5 text-cyan-400" />
                  Tactical Projection
                </h2>
                <p className="mt-2 text-[10px] font-semibold tracking-widest text-slate-500 uppercase italic">Sector 0x7F · Real-time Spatial Arbitration</p>
              </div>
              <div className="flex rounded-xl bg-black/60 p-1 backdrop-blur-md border border-white/10">
                <button
                  onClick={() => setViewMode("commander")}
                  className={`${modeButton} ${
                    viewMode === "commander"
                      ? "bg-cyan-500 text-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.6)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Global
                </button>
                <button
                  onClick={() => setViewMode("detail")}
                  className={`${modeButton} ${
                    viewMode === "detail"
                      ? "bg-cyan-500 text-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.6)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Target
                </button>
              </div>
            </div>

            <div className="relative grow min-h-[500px] w-full bg-[#010204]">
              {/* Cockpit Overlay Elements */}
              <div className="pointer-events-none absolute inset-0 z-20">
                {/* Viewfinder Corners */}
                <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-white/20 rounded-tl-xl" />
                <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-white/20 rounded-tr-xl" />
                <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-white/20 rounded-bl-xl" />
                <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-white/20 rounded-br-xl" />
                
                {/* HUD Elements */}
                <div className="absolute left-10 top-1/2 -translate-y-1/2 space-y-8 opacity-40">
                  <div className="h-24 w-1 bg-white/10 rounded-full relative">
                    <div className="absolute top-1/4 h-1/2 w-full bg-cyan-400 shadow-[0_0_10px_cyan]" />
                  </div>
                  <div className="text-[8px] font-bold text-slate-500 uppercase vertical-text tracking-widest">Altimeter</div>
                </div>

                <div className="absolute right-10 top-1/2 -translate-y-1/2 space-y-8 opacity-40 text-right">
                  <div className="text-[8px] font-bold text-slate-500 uppercase vertical-text tracking-widest">Gain Control</div>
                  <div className="h-24 w-1 bg-white/10 rounded-full ml-auto relative">
                    <div className="absolute bottom-1/3 h-1/4 w-full bg-cyan-400 shadow-[0_0_10px_cyan]" />
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute left-12 top-12 z-20">
                <div className="rounded-xl glass-card px-5 py-3 border-cyan-500/20">
                  <p className="text-[9px] font-black uppercase tracking-[0.4em] text-cyan-400">Nodes Live</p>
                  <p className="mt-1 text-3xl font-black text-white leading-none italic">{bots.length}</p>
                </div>
              </div>

              <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-cyan-500 font-mono text-[10px] animate-pulse">Initializing Tactical Link...</div>}>
                <Canvas camera={{ position: [0, 2.5, 7], fov: 42 }}>
                  <NodeCore
                    bots={bots}
                    selectedBots={selectedBots}
                    spawnedBotIds={spawnedBotIds}
                    zoomTarget={cameraDistanceTarget}
                    onZoomDistance={(distance) => {
                      setCameraDistance(distance);
                      setCameraDistanceTarget(distance);
                    }}
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
              </Suspense>

              {/* Bottom HUD Bar */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-6 px-8 py-4 glass-card rounded-2xl border-white/10 max-w-[90%] w-auto">
                <div className="flex items-center gap-4 border-r border-white/10 pr-6">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Zoom</div>
                  <input
                    type="range"
                    min={MIN_CAMERA_DISTANCE}
                    max={MAX_CAMERA_DISTANCE}
                    step={0.05}
                    value={cameraDistanceTarget}
                    onChange={(e) => setDistanceTarget(Number(e.target.value))}
                    className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400"
                  />
                  <span className="text-[10px] font-black text-cyan-400 w-8">{zoomPercent}%</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setDistanceTarget(DEFAULT_CAMERA_DISTANCE)}
                    className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <div className="h-6 w-[1px] bg-white/10" />
                  <div className="flex gap-1">
                    {SQUADS.map(s => (
                      <div key={s.id} className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: s.color + '44' }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {viewMode === "detail" && selected && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mt-8 grid gap-6 md:grid-cols-2"
              >
                <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
                  <div className="flex items-center gap-6">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-cyan-500/30 bg-black/40 p-1">
                      <UnitPortrait bot={selected} src={ARCHETYPES[selected.archetype].avatar} alt={selected.name} className="h-full w-full rounded-xl" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400">Operator Profile</p>
                      <h3 className="mt-1 text-2xl font-black text-white tracking-tight uppercase">[{selected.callsign}]</h3>
                      <p className="text-sm font-medium tracking-widest text-slate-400 uppercase">{selected.name}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-black/40 p-3 border border-white/5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Archetype</p>
                      <p className="mt-1 text-sm font-bold text-white uppercase">{selected.archetype}</p>
                    </div>
                    <div className="rounded-xl bg-black/40 p-3 border border-white/5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Integrity Tier</p>
                      <p className="mt-1 text-sm font-bold text-cyan-400">TIER {selected.tier}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Model Pipeline</span>
                      <span className="text-[10px] font-bold text-white tracking-widest">{selected.model}</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 w-[85%] shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Last Telemetry</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selected.lastRun}</span>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <button className="flex-1 rounded-xl bg-white/5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-all border border-white/10">Diagnostic</button>
                    <button className="flex-1 rounded-xl bg-cyan-500 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-950 hover:brightness-110 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]">Resync</button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.section>

        <section className="grid gap-6 lg:col-span-4">
          <Card title="Operational Status" value={`${health}%`} sub={`${runningCount} Active · ${pausedCount} Holding`} />
          <div className={`${panelShell} p-6`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Mission Queue</p>
            <ul className="mt-4 space-y-3">
              {missionQueue.map((item, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className={`${panelShell} p-6`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Tactical Legend</p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-emerald-500/5 p-3 border border-emerald-500/10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Active</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-amber-500/5 p-3 border border-amber-500/10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Holding</span>
                <span className="h-2 w-2 rounded-full bg-amber-400" />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-500/5 p-3 border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Standby</span>
                <span className="h-2 w-2 rounded-full bg-slate-400" />
              </div>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-[2rem] border border-cyan-500/20 bg-cyan-500/5 p-6 backdrop-blur-3xl">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl transition-all group-hover:bg-cyan-500/20" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/60">Gateway Protocol</p>
            <p className="mt-2 text-2xl font-black text-white uppercase tracking-tight">Encrypted</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Bound to /api/gateway</p>
          </div>
        </section>

        <section className={`${panelShell} lg:col-span-8 p-6 md:p-8`}>
          <div className="relative">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold uppercase tracking-[0.2em] text-white">Node Roster</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRecruitDraft((prev) => {
                      const autoSquad = firstSquadWithSpace(bots);
                      return {
                        ...prev,
                        callsign: prev.callsign || nextAvailableCallsign(prev.archetype, bots),
                        squadId: prev.squadId || "auto",
                        projectTag: prev.projectTag || autoSquad.projectTag,
                      };
                    });
                    setShowRecruitMenu(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:brightness-110 transition-all"
                >
                  <Swords size={14} /> Recruit Unit
                </button>
                <button
                  onClick={rollback}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-all border border-white/10"
                >
                  <RotateCcw size={14} /> Restore
                </button>
              </div>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-black/40 p-3 backdrop-blur-xl">
              <div className="px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 border-r border-white/10">
                {selectedCount} Selected
              </div>
              <div className="flex gap-2">
                <BatchButton disabled={!selectedCount} onClick={() => applyBatchAction("enable")} tone="emerald">Enable</BatchButton>
                <BatchButton disabled={!selectedCount} onClick={() => applyBatchAction("disable")} tone="rose">Disable</BatchButton>
                <BatchButton disabled={!selectedCount} onClick={() => applyBatchAction("pause")} tone="amber">Pause</BatchButton>
                <BatchButton disabled={!selectedCount} onClick={() => applyBatchAction("resume")} tone="cyan">Resume</BatchButton>
              </div>
              <button
                onClick={() => setSelectedBots([])}
                disabled={!selectedCount}
                className="ml-auto rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all disabled:opacity-0"
              >
                Reset Selection
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {bots.map((b) => {
                const batchSelected = selectedBots.includes(b.id);
                const a = ARCHETYPES[b.archetype];
                const squad = SQUADS.find((s) => s.id === b.squadId) ?? SQUADS[0];
                const seat = Number.isInteger(b.deskSlot) ? ((b.deskSlot as number) % SQUAD_SIZE) + 1 : 1;
                const statusInfo = STATUS_STYLE[b.status];

                return (
                  <motion.div
                    whileHover={{ scale: 1.02, y: -4 }}
                    key={b.id}
                    className={`group relative overflow-hidden rounded-3xl border p-5 transition-all duration-300 ${
                      selectedId === b.id
                        ? "border-cyan-500/50 bg-slate-900/60 shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)]"
                        : "border-white/5 bg-slate-950/40 hover:border-white/20 hover:bg-slate-900/40"
                    }`}
                  >
                    <div className={`pointer-events-none absolute inset-0 opacity-20 transition-opacity group-hover:opacity-40 bg-gradient-to-br ${a.aura}`} />
                    <div className="relative mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={batchSelected}
                            onChange={() => toggleBotSelection(b.id)}
                            className="absolute -left-2 -top-2 z-20 h-5 w-5 rounded-full border-2 border-slate-700 bg-slate-950 text-cyan-500 transition-all checked:border-cyan-500"
                          />
                          <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-1 shadow-2xl">
                            <UnitPortrait bot={b} src={ARCHETYPES[b.archetype].avatar} alt={b.name} className="h-full w-full rounded-xl" />
                          </div>
                        </div>
                        <button className="text-left" onClick={() => setSelectedId(b.id)}>
                          <p className="text-sm font-black text-white uppercase tracking-tight">[{b.callsign}]</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{b.name} · {a.label}</p>
                        </button>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`rounded-lg px-2 py-0.5 text-[8px] font-black uppercase tracking-widest shadow-lg ${a.chip}`}>
                          Tier {b.tier}
                        </span>
                        <div className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2 py-0.5 border border-white/5">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusInfo.color, boxShadow: `0 0 8px ${statusInfo.glow}` }} />
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">{b.status}</span>
                        </div>
                      </div>
                    </div>

                    <div className="relative mb-6 rounded-xl bg-black/20 p-3 border border-white/5">
                      <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500">
                        <span>Squad / Project</span>
                        <span className="text-cyan-400">{squad.name} / {b.projectTag || squad.projectTag}</span>
                      </div>
                      <div className="mt-2 flex justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500">
                        <span>Seat Allocation</span>
                        <span className="text-white">NODE-{seat.toString().padStart(2, '0')}</span>
                      </div>
                    </div>

                    <div className="relative flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedId(b.id);
                          setShowConfig(true);
                        }}
                        className="flex-1 rounded-xl bg-white/5 py-2 text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all border border-white/10"
                      >
                        Loadout
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
                        className="flex-1 rounded-xl bg-white/5 py-2 text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all border border-white/10"
                      >
                        {b.status === "paused" ? "Resume" : "Pause"}
                      </button>
                      <button
                        onClick={() => deleteBot(b.id)}
                        className="rounded-xl bg-rose-500/10 px-3 py-2 text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section className={`${panelShell} lg:col-span-4 p-6 md:p-8`}>
          <div className="relative">
            <h2 className="text-xl font-bold uppercase tracking-[0.2em] text-white">Global Directives</h2>
            <div className="mt-8 space-y-4">
              <button
                onClick={() => sendGatewayAction("summon")}
                className="group relative flex w-full flex-col items-center gap-1 overflow-hidden rounded-2xl bg-cyan-500 py-4 shadow-[0_0_30px_rgba(6,182,212,0.2)] hover:brightness-110 transition-all"
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] transition-all duration-700 group-hover:bg-[position:100%_100%]" />
                <Activity size={20} className="text-slate-950" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-950">Summon All Nodes</span>
              </button>
              <button
                onClick={() => sendGatewayAction("reset")}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-all"
              >
                <Brain size={18} /> Reset All Contexts
              </button>
              <button
                onClick={() => setShowConfig(true)}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-all"
              >
                <Shield size={18} /> Global Security Policy
              </button>
            </div>
            <div className="mt-8 rounded-2xl bg-black/40 p-4 border border-white/5">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">System Logs</p>
              <p className="mt-2 font-mono text-[10px] text-cyan-400/80">
                {gatewayMsg ? `> ${gatewayMsg.toUpperCase()}` : "> WAITING FOR DIRECTIVE..."}
              </p>
            </div>
          </div>
        </section>
      </div>

      {showRecruitMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-950 p-8 shadow-[0_0_100px_rgba(0,0,0,1)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.1),transparent_70%)]" />
            <div className="relative">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white">Recruitment Protocol</h3>
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">Initialize new node operator into command hierarchy</p>
                </div>
                <button
                  className="rounded-xl border border-white/10 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-white"
                  onClick={() => setShowRecruitMenu(false)}
                >
                  Terminate
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
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
                      className={`group relative overflow-hidden rounded-3xl border p-4 text-left transition-all duration-300 ${
                        active
                          ? "border-cyan-500/50 bg-slate-900 shadow-[0_0_30px_rgba(6,182,212,0.2)]"
                          : "border-white/5 bg-slate-950 hover:border-white/20"
                      }`}
                    >
                      <div className={`pointer-events-none absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity bg-gradient-to-br ${a.aura}`} />
                      <div className="relative">
                        <div className="h-32 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-1">
                          <UnitPortrait src={a.avatar} alt={a.label} className="h-full w-full object-cover rounded-xl" />
                        </div>
                        <p className={`mt-4 text-sm font-black uppercase tracking-widest ${a.tone}`}>{a.label}</p>
                        <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase leading-relaxed">{a.role}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <Field
                  label="Designation (Callsign)"
                  value={recruitDraft.callsign}
                  onChange={(v) => setRecruitDraft((p) => ({ ...p, callsign: normalizeCallsign(v) }))}
                />
                <Field label="Operator Legal Name" value={recruitDraft.name} onChange={(v) => setRecruitDraft((p) => ({ ...p, name: v }))} />
                <SelectField
                  label="Squad Assignment"
                  value={recruitDraft.squadId}
                  options={["auto", ...SQUADS.map((s) => s.id)]}
                  onChange={(v) =>
                    setRecruitDraft((p) => ({
                      ...p,
                      squadId: v,
                      projectTag: p.projectTag || (SQUADS.find((s) => s.id === v)?.projectTag ?? p.projectTag),
                    }))
                  }
                />
                <Field
                  label="Project Authorization"
                  value={recruitDraft.projectTag}
                  onChange={(v) => setRecruitDraft((p) => ({ ...p, projectTag: normalizeProjectTag(v) }))}
                />
                <SelectField
                  label="Integrity Tier"
                  value={recruitDraft.tier}
                  options={["I", "II", "III"]}
                  onChange={(v) => setRecruitDraft((p) => ({ ...p, tier: v as BotTier }))}
                />
                <SelectField
                  label="Compute Provider"
                  value={recruitDraft.provider}
                  options={["openai-codex", "google-gemini-cli"]}
                  onChange={(v) => setRecruitDraft((p) => ({ ...p, provider: v as BotConfig["provider"] }))}
                />
              </div>

              <div className="mt-10 flex justify-end">
                <button
                  onClick={recruitBot}
                  className="inline-flex items-center gap-3 rounded-2xl bg-cyan-500 px-10 py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:brightness-110 transition-all"
                >
                  <Swords size={16} /> Deploy Node
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showConfig && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-4xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-950 p-8 shadow-[0_0_100px_rgba(0,0,0,1)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.1),transparent_70%)]" />
            <div className="relative">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white">Node Loadout · [{selected.callsign}]</h3>
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">Modify operational parameters and field capabilities</p>
                </div>
                <button
                  className="rounded-xl border border-white/10 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-white"
                  onClick={() => setShowConfig(false)}
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Designation" value={selected.callsign} onChange={(v) => updateBot({ callsign: v })} />
                <Field label="Operator Name" value={selected.name} onChange={(v) => updateBot({ name: v })} />
                <SelectField
                  label="Squad Assignment"
                  value={selected.squadId || SQUADS[0].id}
                  options={SQUADS.map((s) => s.id)}
                  onChange={(v) => updateBot({ squadId: v })}
                />
                <Field label="Project Authorization" value={selected.projectTag || ""} onChange={(v) => updateBot({ projectTag: v })} />
                <SelectField
                  label="Archetype"
                  value={selected.archetype}
                  options={["sentinel", "sniper", "analyst", "medic"]}
                  onChange={(v) => updateBot({ archetype: v as BotArchetype })}
                />
                <SelectField label="Integrity Tier" value={selected.tier} options={["I", "II", "III"]} onChange={(v) => updateBot({ tier: v as BotTier })} />
                <Field label="Compute Model" value={selected.model} onChange={(v) => updateBot({ model: v })} />
                <SelectField
                  label="Compute Provider"
                  value={selected.provider}
                  options={["openai-codex", "google-gemini-cli"]}
                  onChange={(v) => updateBot({ provider: v as BotConfig["provider"] })}
                />
                <SelectField
                  label="Thinking Density"
                  value={selected.thinking}
                  options={["low", "medium", "high"]}
                  onChange={(v) => updateBot({ thinking: v as BotConfig["thinking"] })}
                />
              </div>

              <div className="mt-10 flex justify-end">
                <button
                  onClick={() => {
                    saveSnapshot(bots);
                    persist(bots);
                    setShowConfig(false);
                  }}
                  className="inline-flex items-center gap-3 rounded-2xl bg-cyan-500 px-10 py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:brightness-110 transition-all"
                >
                  <Save size={16} /> Update Loadout
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

function UnitPortrait({ 
  bot, 
  src, 
  alt, 
  className = "h-full w-full object-cover" 
}: { 
  bot?: BotConfig; 
  src: string; 
  alt: string; 
  className?: string 
}) {
  const charIdx = bot?.characterIndex;
  
  if (typeof charIdx === 'number') {
    const col = charIdx % SPRITE_GRID.cols;
    const row = Math.floor(charIdx / SPRITE_GRID.cols);
    const xPercent = (col / (SPRITE_GRID.cols - 1)) * 100;
    const yPercent = (row / (SPRITE_GRID.rows - 1)) * 100;
    
    return (
      <div className={`${className} overflow-hidden bg-black/20 relative`}>
        <img 
          src={SPRITE_SHEET} 
          alt={alt} 
          className="absolute max-w-none"
          style={{
            width: `${SPRITE_GRID.cols * 100}%`,
            height: `${SPRITE_GRID.rows * 100}%`,
            left: `-${col * 100}%`,
            top: `-${row * 100}%`,
            imageRendering: 'pixelated'
          }}
          draggable={false} 
        />
      </div>
    );
  }
  
  return <img src={src} alt={alt} className={className} draggable={false} />;
}

function Card({
  title,
  value,
  sub,
  compact = false,
}: {
  title: string;
  value: string;
  sub: string;
  compact?: boolean;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/40 backdrop-blur-3xl transition-all duration-300 hover:border-cyan-500/30 ${compact ? "p-4" : "p-6"}`}>
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5 blur-3xl transition-all group-hover:bg-cyan-500/10" />
      <p className={`font-bold uppercase tracking-[0.3em] text-slate-500 ${compact ? "text-[8px]" : "text-[10px]"}`}>{title}</p>
      <p className={`font-black tracking-tight text-white uppercase ${compact ? "mt-2 text-3xl" : "mt-4 text-5xl"}`}>{value}</p>
      <p className={`font-bold uppercase tracking-widest text-cyan-400/60 ${compact ? "mt-1 text-[9px]" : "mt-2 text-[10px]"}`}>{sub}</p>
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
      ? "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950"
      : tone === "rose"
        ? "border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white"
        : tone === "amber"
          ? "border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-950"
          : "border-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-slate-950";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20 disabled:cursor-not-allowed ${toneClass}`}
    >
      {children}
    </button>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/5 bg-black/40 px-5 py-3 text-sm font-medium text-white shadow-inner outline-none transition-all focus:border-cyan-500/50 focus:bg-black/60 focus:shadow-[0_0_20px_rgba(6,182,212,0.1)]"
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
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/5 bg-black/40 px-5 py-3 text-sm font-medium text-white shadow-inner outline-none transition-all focus:border-cyan-500/50 focus:bg-black/60 focus:shadow-[0_0_20px_rgba(6,182,212,0.1)] appearance-none cursor-pointer"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-slate-950 text-white">
            {option.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
