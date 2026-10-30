import React, { useRef } from 'react'
import type { NavItemId, NavGroup } from '../types'
import { NavItem } from './NavItem'
import { Sparkles, Command } from 'lucide-react'

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 1,
    items: [
      { id: 'emails', label: 'Emails', groupId: 1 },
      { id: 'templates', label: 'Templates', groupId: 1 },
      { id: 'audience', label: 'Audience', groupId: 1 },
    ],
  },
  {
    id: 2,
    items: [
      { id: 'inboxes', label: 'Inboxes', groupId: 2, badge: 'Live' },
      { id: 'broadcasts', label: 'Broadcasts', groupId: 2 },
      { id: 'automations', label: 'Automations', groupId: 2 },
    ],
  },
  {
    id: 3,
    items: [
      { id: 'metrics', label: 'Metrics', groupId: 3 },
      { id: 'domains', label: 'Domains', groupId: 3 },
      { id: 'logs', label: 'Logs', groupId: 3 },
      { id: 'api-keys', label: 'API keys', groupId: 3 },
      { id: 'webhooks', label: 'Webhooks', groupId: 3 },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

export interface SidebarProps {
  activeId: NavItemId
  hoveredId: NavItemId | null
  reducedMotion?: boolean
  onSelect: (id: NavItemId) => void
  onHover: (id: NavItemId | null) => void
  onUserInteraction?: () => void
  sidebarRef: React.RefObject<HTMLDivElement | null>
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeId,
  hoveredId,
  reducedMotion = false,
  onSelect,
  onHover,
  onUserInteraction,
  sidebarRef,
}) => {
  const itemRefs = useRef<Map<NavItemId, HTMLButtonElement>>(new Map())

  // Flattened items for keyboard arrow navigation
  const allIds = ALL_NAV_ITEMS.map((item) => item.id)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    onUserInteraction?.()
    const currentIndex = allIds.indexOf(hoveredId ?? activeId)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % allIds.length
      const nextId = allIds[nextIndex]
      onHover(nextId)
      itemRefs.current.get(nextId)?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIndex = (currentIndex - 1 + allIds.length) % allIds.length
      const prevId = allIds[prevIndex]
      onHover(prevId)
      itemRefs.current.get(prevId)?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const currentTarget = hoveredId ?? activeId
      onSelect(currentTarget)
    }
  }

  // Determine which item holds the shared pill
  const highlightedId = hoveredId ?? activeId

  return (
    <aside
      ref={sidebarRef}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => {
        onHover(null)
      }}
      className="w-[240px] shrink-0 h-screen sticky top-0 bg-[#000000] border-r border-white/[0.06] flex flex-col justify-between select-none z-30"
      aria-label="Main Navigation"
    >
      {/* Top Header & Brand */}
      <div className="flex flex-col">
        {/* Workspace Brand Header */}
        <div className="h-[60px] px-4 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 p-[1px] shadow-[0_0_15px_rgba(250,204,21,0.25)] flex items-center justify-center">
              <div className="w-full h-full bg-black rounded-[7px] flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold tracking-tight text-white leading-tight">
                Resendify
              </span>
              <span className="text-[11px] font-normal text-zinc-500 leading-none mt-0.5">
                Production • US-East
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded text-zinc-400">
            <Command className="w-3 h-3 text-zinc-400" />
            <span>K</span>
          </div>
        </div>

        {/* Navigation Groups Container */}
        <nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.id} className="space-y-0.5">
              {/* Items in this group */}
              <div className="space-y-0.5" role="tablist">
                {group.items.map((item) => {
                  const isActive = item.id === activeId
                  const isHovered = item.id === hoveredId
                  const isHighlighted = item.id === highlightedId

                  return (
                    <NavItem
                      key={item.id}
                      item={item}
                      ref={(el) => {
                        if (el) itemRefs.current.set(item.id, el)
                        else itemRefs.current.delete(item.id)
                      }}
                      isActive={isActive}
                      isHovered={isHovered}
                      isHighlighted={isHighlighted}
                      reducedMotion={reducedMotion}
                      onClick={() => {
                        onUserInteraction?.()
                        onSelect(item.id)
                      }}
                      onMouseEnter={() => {
                        onUserInteraction?.()
                        onHover(item.id)
                      }}
                      onFocus={() => {
                        onUserInteraction?.()
                        onHover(item.id)
                      }}
                    />
                  )
                })}
              </div>

              {/* 1px divider between groups with 16px vertical spacing */}
              {groupIndex < NAV_GROUPS.length - 1 && (
                <div className="py-2">
                  <div className="h-[1px] w-full bg-white/[0.08]" />
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Profile & Status */}
      <div className="p-3 border-t border-white/[0.06] bg-[#000000]">
        <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
              Q
            </div>
            <div className="truncate">
              <p className="text-[12px] font-medium text-white truncate leading-none">
                Quaders Team
              </p>
              <p className="text-[10px] text-zinc-500 truncate leading-tight mt-1">
                Enterprise Plan
              </p>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] shrink-0" />
        </div>
      </div>
    </aside>
  )
}
