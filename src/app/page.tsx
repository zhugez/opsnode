"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
    worldTexture: "/assets/characters/sentinel-card.png",
    worldScale: [0.34, 0.38, 1],
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
    worldTexture: "/assets/characters/sniper-card.png",
    worldScale: [0.34, 0.38, 1],
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
    worldTexture: "/assets/characters/analyst-card.png",
    worldScale: [0.34, 0.38, 1],
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
    worldTexture: "/assets/characters/medic-card.png",
    worldScale: [0.34, 0.38, 1],
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

const STATUS_STYLE: Record<BotConfig["status"], { color: string; accent: string }> = {
  idle: { color: "#94a3b8", accent: "#cbd5e1" },
  running: { color: "#22c55e", accent: "#86efac" },
  paused: { color: "#f59e0b", accent: "#fcd34d" },
};

const SQUAD_SIZE = 4;

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
  return index * 1.08 - 1.08;
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
  const x = (seat - (SQUAD_SIZE - 1) / 2) * 0.86;
  return [x, 0.09, laneCenterZ(lane)];
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
    [-1.85, 0.01, 0.68],
    [-0.95, 0.01, 0.36],
    [0, 0.01, 0.22],
    [0.95, 0.01, 0.36],
    [1.85, 0.01, 0.68],
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
      <color attach="background" args={["#0b0d11"]} />
      <ambientLight intensity={0.42} color="#f4efe7" />
      <directionalLight position={[2.4, 4.6, 3.2]} intensity={0.95} color="#fff4df" />
      <directionalLight position={[-3.8, 2.2, -2.6]} intensity={0.3} color="#9caec6" />
      <pointLight position={[0, 2.25, -0.1]} intensity={0.22} color="#ffe4c6" />

      <mesh position={[0, -0.58, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onClearSelection}>
        <planeGeometry args={[9, 6.8]} />
        <meshStandardMaterial color="#141820" roughness={0.74} metalness={0.14} />
      </mesh>

      <mesh position={[0, -0.565, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7, 3.9]} />
        <meshStandardMaterial color="#1f242d" roughness={0.28} metalness={0.42} />
      </mesh>

      {SQUADS.map((baseSquad, lane) => {
        const squad = squadById.get(baseSquad.id) ?? baseSquad;
        const z = laneCenterZ(lane);
        return (
          <group key={squad.id}>
            <mesh position={[0, -0.56, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[6.15, 0.72]} />
              <meshStandardMaterial color={squad.color} transparent opacity={0.1} roughness={0.4} metalness={0.08} />
            </mesh>
            <mesh position={[-1.95, -0.55, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.08, 0.11, 24]} />
              <meshBasicMaterial color={squad.color} transparent opacity={0.55} />
            </mesh>
            <Text position={[-2.1, -0.12, z]} rotation={[0, Math.PI / 2, 0]} fontSize={0.11} color={squad.color} anchorX="center" anchorY="middle">
              {`${squad.name} · ${squad.projectTag}`}
            </Text>
          </group>
        );
      })}

      <group position={[0, -0.55, -2.35]} scale={[4.4, 2.4, 1]}>
        <Clone object={paneling.scene} />
      </group>
      <group position={[-1.95, -0.55, -2.3]} scale={[1.8, 2.4, 1]}>
        <Clone object={wallWindow.scene} />
      </group>
      <group position={[1.95, -0.55, -2.3]} scale={[1.8, 2.4, 1]}>
        <Clone object={wallWindow.scene} />
      </group>

      <group position={[0, -0.49, -0.24]} scale={[1.2, 1.2, 1.2]}>
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
              <ringGeometry args={[0.172, 0.204, 24]} />
              <meshBasicMaterial color={squadColor} transparent opacity={0.24} />
            </mesh>
            <mesh position={[0, -0.006, 0]}>
              <cylinderGeometry args={[0.154, 0.154, 0.016, 18]} />
              <meshStandardMaterial color="#232a33" roughness={0.72} metalness={0.16} />
            </mesh>
            <group position={[0, -0.012, -0.1]} scale={[0.48, 0.48, 0.48]}>
              <Clone object={desk.scene} />
            </group>
            <group position={[0, -0.012, 0.17]} rotation={[0, Math.PI, 0]} scale={[0.36, 0.36, 0.36]}>
              <Clone object={deskChair.scene} />
            </group>
          </group>
        );
      })}

      {[-1.02, -0.34, 0.34, 1.02].map((x, i) => (
        <group key={i} position={[x, 0.36, -0.82]} scale={[0.45, 0.45, 0.45]}>
          <Clone object={computerScreen.scene} />
        </group>
      ))}

      {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
        <group key={`lamp-${i}`} position={[x, 1.8, -0.55]} scale={[0.7, 0.7, 0.7]}>
          <Clone object={lampCeiling.scene} />
        </group>
      ))}

      <Float speed={0.8} rotationIntensity={0.03} floatIntensity={0.08}>
        <mesh position={[0, 1.95, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.015, 12, 64]} />
          <meshStandardMaterial color="#e6d8c4" emissive="#d6c2a4" emissiveIntensity={0.16} roughness={0.3} metalness={0.18} />
        </mesh>
      </Float>

      <Line points={inlayRun} color="#d6c2a4" lineWidth={1} transparent opacity={0.2} />
      <Line points={[[0, 0.06, -1.1], [0, 0.35, -0.75], [0, 1.04, -2.3]]} color="#e2d7c6" lineWidth={0.8} transparent opacity={0.16} />
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
  const panelMatRef = useRef<MeshStandardMaterial>(null);
  const portraitMatRef = useRef<SpriteMaterial>(null);
  const spawnGlowMatRef = useRef<MeshBasicMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const spawnProgressRef = useRef(shouldSpawn ? 0 : 1);
  const style = ARCHETYPES[bot.archetype];
  const statusStyle = STATUS_STYLE[bot.status];
  const portraitTexture = useTexture(style.worldTexture);

  useEffect(() => {
    portraitTexture.needsUpdate = true;
  }, [portraitTexture]);

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
        <spriteMaterial ref={portraitMatRef} map={portraitTexture} transparent depthWrite={false} />
      </sprite>

      <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.17, 0.29, 32]} />
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

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const distance = controls.object.position.distanceTo(controls.target);
    if (Math.abs(distance - distanceRef.current) > 0.02) {
      distanceRef.current = distance;
      onZoomDistance(distance);
    }
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
    "relative overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/50 backdrop-blur-2xl shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_20px_40px_-28px_rgba(0,0,0,0.55)]";
  const modeButton =
    "rounded-lg px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] transition duration-200";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1220] px-4 py-6 font-sans text-slate-100 md:px-8 md:py-10 xl:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,26,38,0.98)_0%,rgba(12,16,27,0.98)_56%,rgba(8,11,19,1)_100%)]" />
        <div className="absolute left-0 top-0 h-[40%] w-full bg-[radial-gradient(ellipse_at_top,rgba(125,211,252,0.06)_0%,rgba(125,211,252,0.02)_50%,transparent_78%)]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-12">
        <section className={`${panelShell} lg:col-span-12 p-4 md:p-5`}>
          <div className="relative grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-100/45">OpsNode · V4</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">Command Center</h1>
              <p className="mt-1 text-xs text-slate-400">Live command hierarchy for mission state, roles, and field control.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-4">
              <Card title="Units" value={`${bots.length}`} sub={`${enabledCount} enabled`} compact />
              <Card title="Running" value={`${runningCount}`} sub="Live execution" compact />
              <Card title="Paused" value={`${pausedCount}`} sub="Awaiting resume" compact />
              <Card title="Selected" value={`${selectedCount}`} sub="Command scope" compact />
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3 lg:col-span-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Mission State</p>
              <p className="mt-1 text-xl font-semibold text-white">{missionState}</p>
              <p className="mt-1 text-xs text-slate-400">Operational integrity {health}% · {disabledCount} disabled</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3 lg:col-span-12">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Role Distribution</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {(Object.keys(roleCounts) as BotArchetype[]).map((key) => (
                  <div key={key} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{ARCHETYPES[key].label}</p>
                    <p className="text-lg font-semibold text-white">{roleCounts[key]}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${panelShell} lg:col-span-8 p-5 md:p-7`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(125,211,252,0.04)_0%,transparent_50%)]" />
          <div className="relative">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/35">Primary Stage</p>
                <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-white md:text-3xl">Spatial Command View</h2>
                <p className="mt-1.5 text-sm text-slate-400">Select, group, and dispatch units from a clean RTS framing.</p>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-emerald-300/80">
                Live Telemetry
              </span>
            </div>

            <div className="mb-4 inline-flex rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
              <button
                onClick={() => setViewMode("commander")}
                className={`${modeButton} ${
                  viewMode === "commander"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Commander
              </button>
              <button
                onClick={() => setViewMode("detail")}
                className={`${modeButton} ${
                  viewMode === "detail"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Detail
              </button>
            </div>

            <div className="relative h-[384px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c1018] shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_20px_50px_-30px_rgba(0,0,0,0.6)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(125,211,252,0.06)_0%,transparent_55%)]" />

              <div className="pointer-events-none absolute left-3 top-3 z-10">
                <motion.span
                  key={selectedCount}
                  initial={{ scale: 0.9, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-200 backdrop-blur-md"
                >
                  <Radar size={11} className="text-cyan-300/80" /> {selectedCount} selected
                </motion.span>
              </div>

              <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-lg bg-black/40 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-slate-300 backdrop-blur-md">
                Orbit · Zoom · Shift+Click multi-select
              </div>

              <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-black/45 px-2.5 py-1.5 text-[9px] uppercase tracking-[0.12em] text-slate-300 backdrop-blur-md">
                <p>{loadoutUnits.length > 0 ? `${loadoutUnits.length} units on duty` : "Recruit units to begin"}</p>
                <p className="mt-0.5 text-[8px] tracking-[0.08em] text-slate-400">● Idle · ● Running · ● Paused</p>
              </div>

              <div className="absolute bottom-12 right-3 z-20 w-[180px] rounded-xl bg-black/50 p-2.5 backdrop-blur-xl">
                <div className="mb-1.5 flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-slate-400">
                  <span>Zoom</span>
                  <span className="text-slate-300">{zoomPercent}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDistanceTarget(cameraDistanceTarget + 0.4)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-slate-300 transition hover:bg-white/10"
                    aria-label="Zoom out"
                  >
                    <ZoomOut size={12} />
                  </button>
                  <input
                    type="range"
                    min={MIN_CAMERA_DISTANCE}
                    max={MAX_CAMERA_DISTANCE}
                    step={0.05}
                    value={cameraDistanceTarget}
                    onChange={(e) => setDistanceTarget(Number(e.target.value))}
                    className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-cyan-300"
                    aria-label="Camera zoom"
                  />
                  <button
                    onClick={() => setDistanceTarget(cameraDistanceTarget - 0.4)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-slate-300 transition hover:bg-white/10"
                    aria-label="Zoom in"
                  >
                    <ZoomIn size={12} />
                  </button>
                </div>
                <button
                  onClick={() => setDistanceTarget(DEFAULT_CAMERA_DISTANCE)}
                  className="mt-1.5 w-full rounded-md bg-white/[0.04] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200"
                >
                  Reset · {cameraDistance.toFixed(1)}m
                </button>
              </div>

              <Canvas camera={{ position: [0, 0.42, DEFAULT_CAMERA_DISTANCE], fov: 52 }}>
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
            </div>

            {viewMode === "commander" ? (
              <div className="mt-4 space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="rounded-xl border border-white/[0.06] bg-slate-950/35 p-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Project Squad Lanes</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {squadsView.map((squad) => (
                      <div key={squad.id} className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">{squad.name}</p>
                        <p className="mt-1 text-[11px] text-cyan-200">Project {squad.projectTag}</p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {squad.members.length}/{SQUAD_SIZE} seats
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Squad Loadout</p>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{selectedCount ? "Manual selection" : "Auto"}</p>
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
                            ? "border-white/[0.08] bg-slate-900/60"
                            : "border-white/[0.05] bg-slate-950/30"
                        }`}
                      >
                        {bot && <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${a?.aura}`} />}
                        <div className="relative flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-slate-950/70">
                            {bot ? <UnitPortrait src={ARCHETYPES[bot.archetype].avatar} alt={bot.name} /> : <span className="text-slate-500 text-xs">—</span>}
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500">{slotLabel}</p>
                            <p className="text-sm font-medium text-white">{bot ? `[${bot.callsign}]` : "Empty"}</p>
                            {bot && (
                              <p className="text-[11px] text-slate-400">
                                {bot.name} · {a?.label} {bot.tier}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-slate-950/50 p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Selected Unit</p>
                  {selected && (
                    <div className="mt-2 h-20 w-full overflow-hidden rounded-lg border border-white/10 bg-slate-950/70">
                      <UnitPortrait src={ARCHETYPES[selected.archetype].avatar} alt={selected.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <p className="mt-2 text-xl font-semibold text-white">{selected ? `[${selected.callsign}]` : "-"}</p>
                  <p className="mt-1 text-xs text-slate-400">{selected ? `${selected.name} · ${ARCHETYPES[selected.archetype].label} · Tier ${selected.tier}` : "-"}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {selected?.provider} · {selected?.model}
                  </p>
                  <p className="mt-0.5 text-[11px] text-cyan-200/80">
                    {(SQUADS.find((s) => s.id === selected?.squadId) ?? SQUADS[0]).name} · Project {selected?.projectTag}
                  </p>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-slate-950/50 px-3 py-2.5 text-xs text-slate-300">
                    <CheckCircle2 size={14} className="text-emerald-400/70" />
                    Command integrity: {health}%
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-slate-950/50 px-3 py-2.5 text-xs text-slate-300">
                    <Clock3 size={14} className="text-slate-400" />
                    Last event: {selected?.lastRun || "-"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        <section className="grid gap-4 lg:col-span-4">
          <Card title="Operational" value={`${health}%`} sub={`${runningCount} running · ${pausedCount} paused`} />
          <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-slate-900/40 p-4 backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Mission Queue</p>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
              {missionQueue.map((item) => (
                <li key={item} className="rounded-md border border-white/[0.04] bg-black/20 px-2 py-1.5">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-slate-900/40 p-4 backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Status Legend</p>
            <div className="mt-2 grid gap-2 text-xs">
              <p className="rounded-md border border-emerald-400/20 bg-emerald-500/8 px-2 py-1 text-emerald-200">Running: actively executing tasks</p>
              <p className="rounded-md border border-amber-400/20 bg-amber-500/8 px-2 py-1 text-amber-200">Paused: held for command input</p>
              <p className="rounded-md border border-slate-400/20 bg-slate-500/8 px-2 py-1 text-slate-300">Idle: ready but not currently executing</p>
            </div>
          </div>
          <Card title="Gateway" value="Bound" sub="/api/gateway-action wired" />
        </section>

        <section className={`${panelShell} lg:col-span-8 p-5 md:p-6`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(56,189,248,0.03)_0%,transparent_50%)]" />
          <div className="relative">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-white">Roster</h2>
              <div className="flex flex-wrap gap-2">
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:brightness-110"
                >
                  <Swords size={14} /> Recruit Menu
                </button>
                <button
                  onClick={rollback}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:bg-slate-700/50"
                >
                  <RotateCcw size={14} /> Rollback
                </button>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-slate-900/30 p-2 text-xs">
              <motion.span
                key={selectedCount}
                initial={{ scale: 0.9, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-md bg-white/[0.05] px-2 py-1 text-slate-300"
              >
                {selectedCount} selected
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
                className="rounded-lg border border-white/10 px-2 py-1 text-slate-400 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {bots.map((b) => {
                const batchSelected = selectedBots.includes(b.id);
                const a = ARCHETYPES[b.archetype];
                const squad = SQUADS.find((s) => s.id === b.squadId) ?? SQUADS[0];
                const seat = Number.isInteger(b.deskSlot) ? ((b.deskSlot as number) % SQUAD_SIZE) + 1 : 1;

                return (
                  <motion.div
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.18 }}
                    key={b.id}
                    className={`relative overflow-hidden rounded-xl border p-3.5 transition ${
                      selectedId === b.id
                        ? "border-white/[0.12] bg-slate-900/70 shadow-[0_0_16px_-10px_rgba(34,211,238,0.4)]"
                        : "border-white/[0.06] bg-slate-950/40 hover:border-white/[0.1] hover:bg-slate-900/50"
                    } ${batchSelected ? "ring-1 ring-violet-300/25" : ""}`}
                  >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${a.aura}`} />
                    <div className="relative mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={batchSelected}
                          onChange={() => toggleBotSelection(b.id)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-500 bg-slate-900 text-cyan-300"
                        />
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-slate-950/70">
                          <UnitPortrait src={ARCHETYPES[b.archetype].avatar} alt={b.name} />
                        </div>
                        <button className="text-left" onClick={() => setSelectedId(b.id)}>
                          <p className="text-sm font-semibold text-white">[{b.callsign}]</p>
                          <p className="text-[11px] text-slate-400">{b.name} · {a.label}</p>
                          <p className="text-[10px] text-cyan-200/85">
                            {squad.name} · {b.projectTag || squad.projectTag} · Seat {seat}
                          </p>
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-md px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] ${a.chip}`}>
                          {b.tier}
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] ${
                            b.status === "running"
                              ? "bg-emerald-500/12 text-emerald-300"
                              : b.status === "paused"
                                ? "bg-amber-500/12 text-amber-300"
                                : "bg-slate-500/15 text-slate-400"
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                    </div>

                    <div className="relative mb-2.5 text-[10px] text-slate-500">
                      {a.role} · {b.provider} · {b.model}
                    </div>

                    <div className="relative flex flex-wrap gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedId(b.id);
                          setShowConfig(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/[0.07]"
                      >
                        <Settings size={12} /> Loadout
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
                        className="inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/[0.07]"
                      >
                        {b.status === "paused" ? <Play size={12} /> : <Pause size={12} />}
                        {b.status === "paused" ? "Resume" : "Pause"}
                      </button>
                      <button
                        onClick={() => {
                          const next = bots.map((x) => (x.id === b.id ? { ...x, enabled: !x.enabled } : x));
                          persist(next);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/[0.07]"
                      >
                        <Power size={12} /> {b.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => deleteBot(b.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-400/10 bg-rose-500/[0.04] px-2 py-1 text-[11px] text-rose-300/70 transition hover:bg-rose-500/10"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section className={`${panelShell} lg:col-span-4 p-5 md:p-6`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(56,189,248,0.03)_0%,transparent_50%)]" />
          <div className="relative">
            <h2 className="text-xl font-semibold tracking-tight text-white">Quick Actions</h2>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">Gateway Dispatch</p>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => sendGatewayAction("summon")}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:brightness-110"
              >
                <Activity size={15} /> Summon All
              </button>
              <button
                onClick={() => sendGatewayAction("reset")}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.07]"
              >
                <Brain size={15} /> Reset Context
              </button>
              <button
                onClick={() => setShowConfig(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.07]"
              >
                <Shield size={15} /> Open Loadout
              </button>
            </div>
            <p className="mt-3 rounded-md bg-white/[0.03] px-3 py-2 text-[11px] text-slate-500">
              {gatewayMsg || "Gateway ready"}
            </p>
          </div>
        </section>
      </div>

      {showRecruitMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-4 backdrop-blur-sm md:items-center">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-950/95 p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl md:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(56,189,248,0.03)_0%,transparent_50%)]" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-white">Recruit Menu</h3>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Choose archetype, project squad lane, and operational profile</p>
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
                  label="Squad Lane"
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
                  label="Project Tag"
                  value={recruitDraft.projectTag}
                  onChange={(v) => setRecruitDraft((p) => ({ ...p, projectTag: normalizeProjectTag(v) }))}
                />
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
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300 px-4 py-2 font-semibold text-slate-950 transition hover:brightness-110"
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
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-950/95 p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl md:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(56,189,248,0.03)_0%,transparent_50%)]" />
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
                  label="Squad"
                  value={selected.squadId || SQUADS[0].id}
                  options={SQUADS.map((s) => s.id)}
                  onChange={(v) => updateBot({ squadId: v })}
                />
                <Field label="Project Tag" value={selected.projectTag || ""} onChange={(v) => updateBot({ projectTag: v })} />
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
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300 px-4 py-2 font-semibold text-slate-950 transition hover:brightness-110"
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
    <div className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-slate-900/40 backdrop-blur-xl ${compact ? "p-3" : "p-4"}`}>
      <p className={`uppercase tracking-[0.22em] text-slate-400 ${compact ? "text-[9px]" : "text-[10px]"}`}>{title}</p>
      <p className={`font-semibold tracking-tight text-white ${compact ? "mt-1 text-2xl" : "mt-2 text-3xl"}`}>{value}</p>
      <p className={`text-slate-400 ${compact ? "mt-0.5 text-[11px]" : "mt-1 text-xs"}`}>{sub}</p>
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
