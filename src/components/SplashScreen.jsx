import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  GOONSQUAD_LOGO_SRC,
  GOONSQUAD_MOTTO,
} from '../brand/teamBrand';

const MotionDiv = motion.div;
const MotionImg = motion.img;
const TOTAL_DURATION = 1450;

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
            background: '#f7f7f6',
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <MotionDiv
            initial={{ scale: 0.94, opacity: 0, y: 8 }}
            animate={{
              scale: [0.94, 1, 1.02],
              opacity: [0, 1, 1],
              y: [8, 0, 0],
            }}
            transition={{
              duration: 1.15,
              times: [0, 0.35, 1],
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              width: 'min(62vw, 360px)',
              display: 'grid',
              justifyItems: 'center',
              gap: 12,
            }}
          >
            <MotionImg
              src={GOONSQUAD_LOGO_SRC}
              alt="Goonsquad"
              draggable={false}
              style={{
                width: '100%',
                height: 'auto',
                pointerEvents: 'none',
              }}
            />
            <MotionDiv
              initial={{ width: 0 }}
              animate={{ width: '72%' }}
              transition={{ delay: 0.35, duration: 0.45, ease: 'easeOut' }}
              style={{
                height: 3,
                background: 'linear-gradient(90deg, #d3132a 0 72%, #00a6ca 72%)',
              }}
            />
            <span
              style={{
                color: '#15171a',
                fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif',
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              {GOONSQUAD_MOTTO}
            </span>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}
