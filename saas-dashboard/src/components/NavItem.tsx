import React from 'react'
import type { NavItemConfig } from '../types'
import { AnimatedIcon } from './AnimatedIcons'
import { NavPill } from './NavPill'

interface NavItemProps {
  item: NavItemConfig
  isActive: boolean
  isHovered: boolean
  isHighlighted: boolean // true if hovered || (isActive && no other item hovered)
  reducedMotion?: boolean
  onClick: () => void
  onMouseEnter: () => void
  onFocus: () => void
}

export const NavItem = React.forwardRef<HTMLButtonElement, NavItemProps>(
  (
    {
      item,
      isActive,
      isHovered,
      isHighlighted,
      reducedMotion = false,
      onClick,
      onMouseEnter,
      onFocus,
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        data-nav-id={item.id}
        id={`nav-item-${item.id}`}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        aria-selected={isActive}
        role="tab"
        className={`relative w-full h-[40px] px-[12px] flex items-center justify-between rounded-[12px] select-none text-[14px] font-medium text-left cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-white/20 ${
          isHighlighted ? 'text-white' : 'text-[#9ca3af] hover:text-white'
        }`}
      >
        {/* Shared Nav Pill */}
        {isHighlighted && <NavPill reducedMotion={reducedMotion} />}

        {/* Content: Icon + Label (z-10 sits above pill) */}
        <div className="relative z-10 flex items-center gap-[10px] min-w-0">
          <span
            className={`flex items-center justify-center transition-colors duration-150 ${
              isHighlighted ? 'text-white' : 'text-[#9ca3af]'
            }`}
          >
            <AnimatedIcon
              id={item.id}
              isHovered={isHovered}
              isActive={isActive}
              reducedMotion={reducedMotion}
            />
          </span>

          <span className="truncate tracking-[-0.01em] font-medium">
            {item.label}
          </span>
        </div>

        {/* Optional pill badge */}
        {item.badge && (
          <span className="relative z-10 text-[10px] tracking-wide font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 group-hover:text-zinc-200">
            {item.badge}
          </span>
        )}
      </button>
    )
  }
)

NavItem.displayName = 'NavItem'
