import React from 'react'
import { motion } from 'framer-motion'

interface DemoCursorProps {
  visible: boolean
  x: number
  y: number
  targetLabel?: string
}

export const DemoCursor: React.FC<DemoCursorProps> = ({
  visible,
  x,
  y,
  targetLabel,
}) => {
  if (!visible) return null

  return (
    <motion.div
      className="pointer-events-none absolute z-50 select-none top-0 left-0"
      initial={{ opacity: 0, x, y }}
      animate={{
        opacity: 1,
        x,
        y,
      }}
      exit={{ opacity: 0 }}
      transition={{
        x: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
        y: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.2 },
      }}
    >
      {/* Authentic Yellow (#FACC15) Pixel Hand Cursor */}
      <div className="relative -top-1 -left-2 filter drop-shadow-[0_4px_10px_rgba(250,204,21,0.35)]">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Black pixel border / shadow silhouette */}
          <path
            d="M8 1h3v7h2V5h3v5h2V7h3v8h-1v2h-1v2h-1v2h-2v1h-7v-1H6v-5H5v-7h3V1z"
            fill="#000000"
          />
          {/* Vibrant #FACC15 Hand fill */}
          <path
            d="M9 2h1v6h1v-2h1V6h1v-1h1v4h1v-2h1V8h1v6h-1v2h-1v2h-1v2H9v-1H7v-4H6v-5h2V2h1z"
            fill="#FACC15"
          />
          {/* Subtle pixel highlight accents */}
          <path
            d="M9 3h1v4H9V3zm3 4h1v1h-1V7zm3 2h1v1h-1V9z"
            fill="#FEF08A"
          />
          {/* Pixel shadow detail inside hand */}
          <path
            d="M10 17h4v1h-4v-1zm4-2h1v2h-1v-2zm-3-8h1v2h-1V7z"
            fill="#CA8A04"
          />
        </svg>

        {/* Small badge next to cursor showing demo state */}
        <div className="absolute left-6 top-1 pointer-events-none whitespace-nowrap bg-yellow-400/90 text-black font-semibold text-[10px] px-1.5 py-0.5 rounded shadow-md uppercase tracking-wider scale-90 origin-left">
          {targetLabel ? `Preview: ${targetLabel}` : 'Demo'}
        </div>
      </div>
    </motion.div>
  )
}
