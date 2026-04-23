"use client"
import { motion, useReducedMotion } from "motion/react"
import SectionHeader from "./SectionHeader"
import { LANDING_COPY } from "@/lib/landing/content"

const EXPO_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number]

export default function ProblemStatement() {
  const reduced = useReducedMotion()

  return (
    <section className="bg-[#111113] text-white py-32 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          number="01"
          title="The job-hunt problem"
          light
        />

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 48 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.8, ease: EXPO_OUT }}
        >
          <p
            className="font-semibold tracking-[-0.03em] leading-[1.05] max-w-5xl"
            style={{ fontSize: "clamp(36px, 5.5vw, 76px)" }}
          >
            You&apos;ve applied to{" "}
            <span className="text-white/40">47 places.</span>
            {" "}You don&apos;t remember{" "}
            <span className="text-white/40">31 of them.</span>
            {" "}None of them remember you either.
          </p>
        </motion.div>

        <motion.p
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7, ease: EXPO_OUT, delay: 0.15 }}
          className="mt-8 text-lg text-white/50 max-w-2xl leading-relaxed"
        >
          {LANDING_COPY.problemSub}
        </motion.p>
      </div>
    </section>
  )
}
