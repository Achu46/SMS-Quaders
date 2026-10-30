import React from 'react'
import { motion } from 'framer-motion'

interface NavPillProps {
  reducedMotion?: boolean
}

export const NavPill: React.FC<NavPillProps> = ({ reducedMotion = false }) => {
  return (
    <motion.div
      layoutId="nav-pill"
      className="absolute inset-0 bg-[#16161a] rounded-[12px] pointer-events-none z-0 border border-white/[0.03] shadow-[0_0_12px_rgba(0,0,0,0.5)]"
      initial={{ opacity: 0.6 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={
        reducedMotion
          ? { duration: 0.15, ease: 'easeOut' }
          : {
              type: 'spring',
              stiffness: 600,
              damping: 40,
              mass: 0.5,
              opacity: { duration: 0.12, ease: 'easeOut' },
            }
      }
    />
  )
}
