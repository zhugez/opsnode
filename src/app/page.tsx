"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sphere, MeshDistortMaterial, Float, Line } from "@react-three/drei";
import { motion } from "framer-motion";
import { Activity, Brain, CheckCircle2, Clock3, Zap } from "lucide-react";

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

      <Float speed={1.6} rotationIntensity={0.35} floatIntensity={0.8}>
        <Sphere args={[1.15, 64, 64]}>
          <MeshDistortMaterial
            color="#5bd1ff"
            emissive="#1a6a8c"
            emissiveIntensity={0.6}
            roughness={0.1}
            metalness={0.35}
            distort={0.35}
            speed={2.1}
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

      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.8} />
    </>
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

export default function Page() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#10213c_0%,#090d16_55%,#05070d_100%)] p-6 text-white md:p-10">
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-12">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-8 rounded-3xl border border-cyan-300/20 bg-slate-950/45 p-4 md:p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">OpsNode</h1>
              <p className="text-sm text-cyan-100/80">Yu Control Center · 3D command cockpit</p>
            </div>
            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs text-emerald-300">LIVE</span>
          </div>
          <div className="h-[380px] rounded-2xl border border-cyan-200/20 bg-slate-900/50">
            <Canvas camera={{ position: [0, 0, 4.2], fov: 55 }}>
              <NodeCore />
            </Canvas>
          </div>
        </motion.section>

        <section className="grid gap-4 lg:col-span-4">
          <Card title="Agents" value="Yasna · Zhu" sub="Both online · idle" />
          <Card title="Health" value="100%" sub="All critical checks passing" />
          <Card title="Cost Today" value="$0.50" sub="Low burn mode" />
          <Card title="Queue" value="3 tasks" sub="1 doing · 2 todo" />
        </section>

        <section className="lg:col-span-8 rounded-3xl border border-cyan-300/20 bg-slate-950/45 p-5">
          <h2 className="mb-4 text-lg font-semibold">Task Board</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-900/70 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm text-cyan-300"><Clock3 size={16} /> Todo</p>
              <ul className="space-y-2 text-sm text-slate-200">
                <li>Wireframe OpsNode v1</li>
                <li>Add role-based controls</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-slate-900/70 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm text-violet-300"><Activity size={16} /> Doing</p>
              <ul className="space-y-2 text-sm text-slate-200">
                <li>3D cockpit polish</li>
                <li>Gateway action mapping</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-slate-900/70 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 size={16} /> Done</p>
              <ul className="space-y-2 text-sm text-slate-200">
                <li>OpsNode domain claimed</li>
                <li>Daily learning cron set</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="lg:col-span-4 rounded-3xl border border-cyan-300/20 bg-slate-950/45 p-5">
          <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
          <div className="space-y-3">
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-medium text-slate-950 hover:bg-cyan-400">
              <Zap size={16} /> Summon All
            </button>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 px-4 py-2.5 text-cyan-200 hover:bg-cyan-500/10">
              <Brain size={16} /> Reset Context
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-300">MVP UI live. Next step: bind actions to OpenClaw gateway endpoints.</p>
        </section>
      </div>
    </main>
  );
}
