"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Activity, Brain, Radar, Shield, Sparkles, Workflow } from "lucide-react";

const tracks = [
  {
    title: "Visual Research",
    desc: "VoxYZ + Ralv references distilled into motion, depth, and glow rules.",
    status: "in-progress",
  },
  {
    title: "Command Layout",
    desc: "Build modular tactical panels (stage, telemetry, action rail).",
    status: "next",
  },
  {
    title: "3D Scene Return",
    desc: "Re-introduce R3F scene with stable fallback and no blocking overlay.",
    status: "queued",
  },
];

const kpis = [
  { label: "Modules", value: "06", icon: Workflow },
  { label: "Scene State", value: "RESET", icon: Radar },
  { label: "Risk", value: "LOW", icon: Shield },
  { label: "Tempo", value: "ACTIVE", icon: Activity },
];

export default function Page() {
  return (
    <main className="min-h-screen bg-[#020408] text-slate-100 selection:bg-cyan-400/30">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel relative overflow-hidden rounded-[28px] p-6 md:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(125,211,192,0.18),transparent_48%),radial-gradient(circle_at_80%_10%,rgba(45,93,161,0.24),transparent_52%)]" />

          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">OpsNode / Rebuild Sprint</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">Command Surface vNext</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">
                FE đã chuyển từ reset sang phase build lại: ưu tiên shell cao cấp, tactical readability, rồi mới return
                scene 3D.
              </p>

            <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10">
              <Image
                src="/assets/landing-hero.jpg"
                alt="OpsNode landing visual"
                width={1600}
                height={900}
                className="h-auto w-full object-cover"
                priority
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020408]/75 via-transparent to-transparent" />
            </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-slate-300">
              <p className="flex items-center gap-2 uppercase tracking-[0.2em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" /> status
              </p>
              <p className="mt-2 font-semibold text-slate-100">Research-first rebuild active</p>
            </div>
          </div>
        </motion.section>

        <section className="mt-6 grid gap-6 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-panel lg:col-span-8 rounded-[24px] p-5 md:p-6"
          >
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
              <Brain className="h-4 w-4" /> Build Tracks
            </h2>

            <div className="mt-4 grid gap-3">
              {tracks.map((item, idx) => (
                <div key={item.title} className="glass-card rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-100">
                        {idx + 1}. {item.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">{item.desc}</p>
                    </div>
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-slate-300">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-panel lg:col-span-4 rounded-[24px] p-5 md:p-6"
          >
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-amber-200">
              <Radar className="h-4 w-4" /> Quick Telemetry
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {kpis.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                      <Icon className="h-3.5 w-3.5" /> {item.label}
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-100">{item.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-xs text-cyan-100">
              Next step: dựng lại tactical layout block-based, sau đó gắn lại 3D scene với fallback nhẹ để không bị treo UI.
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
