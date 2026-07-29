import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import skullUpper from "../assets/skull_upper.png";
import skullJaw from "../assets/skull_jaw.png";
import skullLogo from "../assets/skull_logo.png";

const MotionDiv = motion.div;
const MotionImg = motion.img;

/**
 * SplashScreen — Goonsquad 3-layer logo intro
 *
 * Layers (all positioned in a shared 500x500 coordinate space):
 *   1. Upper skull + helmet + upper teeth  — FIXED
 *   2. Lower jaw / teeth                   — ANIMATES (drops open)
 *   3. GOONSQUAD text                      — FIXED
 *
 * Sequence:
 *   0.0–0.3s  Black screen
 *   0.3–0.6s  Logo fades in
 *   1.3s      Jaw drops open (rotates counter-clockwise from top-right hinge)
 *   1.7s      Zoom into mouth gap, fades to black
 *   3.1s      Splash unmounts, app visible
 */

const TOTAL_DURATION = 3100;

export default function SplashScreen({ onComplete }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, TOTAL_DURATION);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <MotionDiv
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Zoom container — focal point at mouth gap */}
          <MotionDiv
            initial={{ scale: 1, opacity: 0 }}
            animate={{
              scale: [1, 1, 1, 18],
              opacity: [0, 1, 1, 1],
            }}
            transition={{
              duration: 2.8,
              times: [0, 0.1, 0.5, 1],
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              width: "min(70vw, 70vh)",
              height: "min(70vw, 70vh)",
              position: "relative",
              transformOrigin: "50% 70%",
            }}
          >
            {/* Layer 1: Upper skull — fixed */}
            <img
              src={skullUpper}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: "30.4%",
                top: "14.4%",
                width: "46.4%",
                height: "61%",
                pointerEvents: "none",
              }}
            />

            {/* Layer 2: Jaw — drops open */}
            <MotionImg
              src={skullJaw}
              alt=""
              draggable={false}
              initial={{ rotate: 0 }}
              animate={{
                rotate: [0, 0, -20, -18, -18],
              }}
              transition={{
                duration: 2.8,
                times: [0, 0.35, 0.55, 0.6, 1],
                ease: [0.25, 1, 0.5, 1],
              }}
              style={{
                position: "absolute",
                left: "37.2%",
                top: "62.8%",
                width: "25.4%",
                height: "12.8%",
                pointerEvents: "none",
                transformOrigin: "90% 0%",
              }}
            />

            {/* Layer 3: GOONSQUAD text — fixed */}
            <img
              src={skullLogo}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: "7.6%",
                top: "75.6%",
                width: "88%",
                height: "18.2%",
                pointerEvents: "none",
              }}
            />
          </MotionDiv>

          {/* Dark overlay for transition */}
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0, 0.6, 1],
            }}
            transition={{
              duration: 2.8,
              times: [0, 0.55, 0.8, 1],
              ease: "easeIn",
            }}
            style={{
              position: "absolute",
              inset: 0,
              background: "#000",
              pointerEvents: "none",
            }}
          />
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}
