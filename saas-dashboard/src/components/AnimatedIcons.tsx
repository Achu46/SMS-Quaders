import React from 'react'
import { motion } from 'framer-motion'
import {
  LayoutTemplate,
  Users,
  BarChart3,
  Globe,
  ScrollText,
  Key,
  Webhook,
} from 'lucide-react'
import type { NavItemId } from '../types'

interface AnimatedIconProps {
  id: NavItemId
  isHovered: boolean
  isActive: boolean
  reducedMotion?: boolean
  className?: string
}

export const AnimatedIcon: React.FC<AnimatedIconProps> = ({
  id,
  isHovered,
  isActive,
  reducedMotion = false,
  className = '',
}) => {
  const isTriggered = isHovered || isActive

  // 1. Mail Flap lift animation (150ms)
  if (id === 'emails') {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ perspective: 600, overflow: 'visible' }}
      >
        {/* Mail Envelope Body */}
        <rect width="20" height="15" x="2" y="5" rx="2.5" />
        {/* Envelope back lines for depth */}
        <path d="m2 19 6.5-6.5" opacity="0.4" />
        <path d="m22 19-6.5-6.5" opacity="0.4" />
        {/* Flap: rotates up on hover/activate */}
        <motion.path
          d={
            !reducedMotion && isTriggered
              ? 'm2 5 10-4.5 10 4.5' // flap lifted open
              : 'm2 5 10 7.5 10-7.5' // flap closed
          }
          animate={{
            d:
              !reducedMotion && isTriggered
                ? 'm2 5 10-4.5 10 4.5'
                : 'm2 5 10 7.5 10-7.5',
          }}
          transition={{
            duration: reducedMotion ? 0 : 0.15,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      </svg>
    )
  }

  // 2. Inbox: tray lid opens slightly (translateY -2px + downward arrow slides in)
  if (id === 'inboxes') {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ overflow: 'visible' }}
      >
        {/* Downward arrow that slides in */}
        <motion.g
          animate={
            !reducedMotion && isTriggered
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: -4 }
          }
          transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
        >
          <line x1="12" y1="2" x2="12" y2="8" />
          <polyline points="9 5.5 12 8.5 15 5.5" />
        </motion.g>

        {/* Tray top rim lid (opens slightly translateY -2px) */}
        <motion.path
          d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
          animate={
            !reducedMotion && isTriggered ? { y: -2 } : { y: 0 }
          }
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
        />

        {/* Front tray notch cutout */}
        <motion.polyline
          points="22 12 17.5 12 15 15.5 9 15.5 6.5 12 2 12"
          animate={
            !reducedMotion && isTriggered ? { y: -1 } : { y: 0 }
          }
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
        />
      </svg>
    )
  }

  // 3. Broadcasts/Radio: concentric signal arcs pulse outward (scale 0.8→1.1, opacity 0.4→1, staggered 60ms)
  if (id === 'broadcasts') {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ overflow: 'visible' }}
      >
        {/* Center transmitter dot */}
        <circle cx="12" cy="12" r="2" fill="currentColor" />

        {/* Inner concentric arc */}
        <motion.path
          d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49"
          style={{ originX: '12px', originY: '12px' }}
          animate={
            !reducedMotion && isTriggered
              ? {
                  scale: [0.8, 1.1, 1],
                  opacity: [0.4, 1, 1],
                }
              : { scale: 1, opacity: 1 }
          }
          transition={{
            duration: reducedMotion ? 0 : 0.45,
            ease: [0.16, 1, 0.3, 1],
          }}
        />

        {/* Outer concentric arc (staggered by 60ms) */}
        <motion.path
          d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"
          style={{ originX: '12px', originY: '12px' }}
          animate={
            !reducedMotion && isTriggered
              ? {
                  scale: [0.8, 1.12, 1],
                  opacity: [0.35, 1, 1],
                }
              : { scale: 1, opacity: 1 }
          }
          transition={{
            duration: reducedMotion ? 0 : 0.48,
            delay: reducedMotion ? 0 : 0.06, // 60ms stagger
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      </svg>
    )
  }

  // 4. Automations/Workflow: two nodes nudge apart then back (spring)
  if (id === 'automations') {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ overflow: 'visible' }}
      >
        {/* Top Node */}
        <rect width="6" height="6" x="9" y="3" rx="1.5" />

        {/* Connection Branching Lines */}
        <motion.path
          d={
            !reducedMotion && isTriggered
              ? 'M12 9v3 M3 15v-1a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1'
              : 'M12 9v3 M5 15v-1a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1'
          }
          animate={{
            d:
              !reducedMotion && isTriggered
                ? 'M12 9v3 M3 15v-1a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1'
                : 'M12 9v3 M5 15v-1a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1',
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 20,
          }}
        />

        {/* Left Bottom Node nudges left */}
        <motion.rect
          width="6"
          height="6"
          x="2"
          y="15"
          rx="1.5"
          animate={
            !reducedMotion && isTriggered
              ? { x: [-2.5, 0] }
              : { x: 0 }
          }
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 18,
          }}
        />

        {/* Right Bottom Node nudges right */}
        <motion.rect
          width="6"
          height="6"
          x="16"
          y="15"
          rx="1.5"
          animate={
            !reducedMotion && isTriggered
              ? { x: [2.5, 0] }
              : { x: 0 }
          }
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 18,
          }}
        />
      </svg>
    )
  }

  // 5. Others: gentle scale 1 -> 1.08 with a spring
  const iconProps = { size: 18, strokeWidth: 1.5, className }

  const renderBaseIcon = () => {
    switch (id) {
      case 'templates':
        return <LayoutTemplate {...iconProps} />
      case 'audience':
        return <Users {...iconProps} />
      case 'metrics':
        return <BarChart3 {...iconProps} />
      case 'domains':
        return <Globe {...iconProps} />
      case 'logs':
        return <ScrollText {...iconProps} />
      case 'api-keys':
        return <Key {...iconProps} />
      case 'webhooks':
        return <Webhook {...iconProps} />
      default:
        return null
    }
  }

  return (
    <motion.div
      className="inline-flex items-center justify-center"
      animate={
        !reducedMotion && isTriggered
          ? { scale: 1.08 }
          : { scale: 1 }
      }
      transition={{
        type: 'spring',
        stiffness: 450,
        damping: 22,
      }}
    >
      {renderBaseIcon()}
    </motion.div>
  )
}
