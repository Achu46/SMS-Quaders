import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import type { NavItemId } from './types';

const DEMO_ITEMS: NavItemId[] = ['Emails', 'Inboxes', 'Broadcasts', 'Automations'];

export function App() {
  const [activeId, setActiveId] = useState<NavItemId>('Emails');
  const [hoveredId, setHoveredId] = useState<NavItemId | null>(null);
  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  const demoIndexRef = useRef<number>(0);
  const userInteractedRef = useRef<boolean>(false);
  const initialMountTimeRef = useRef<number>(Date.now());

  // Listen to system prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Demo mode loop:
  // Loops: Emails → Inboxes → Broadcasts → Automations → Emails
  // Pauses ~700ms on each item, glide 300ms, triggering pill + icon animation
  useEffect(() => {
    if (!demoMode) return;

    // Set first demo item immediately
    const firstItem = DEMO_ITEMS[demoIndexRef.current];
    setHoveredId(firstItem);
    setActiveId(firstItem);

    const interval = setInterval(() => {
      // Check 10s timeout for initial auto-demo
      if (!userInteractedRef.current && Date.now() - initialMountTimeRef.current >= 10000) {
        setDemoMode(false);
        setHoveredId(null);
        clearInterval(interval);
        return;
      }

      demoIndexRef.current = (demoIndexRef.current + 1) % DEMO_ITEMS.length;
      const nextItem = DEMO_ITEMS[demoIndexRef.current];
      setHoveredId(nextItem);
      setActiveId(nextItem);
    }, 1000); // 300ms glide + 700ms dwell/pause

    return () => clearInterval(interval);
  }, [demoMode]);

  // Cancel demo mode on genuine user interaction
  useEffect(() => {
    let startPos: { x: number; y: number } | null = null;

    const handlePointerMove = (e: MouseEvent) => {
      if (!startPos) {
        startPos = { x: e.clientX, y: e.clientY };
        return;
      }
      const dist = Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y);
      if (dist > 20 && demoMode) {
        userInteractedRef.current = true;
        setDemoMode(false);
        setHoveredId(null);
      }
    };

    const handleInteraction = () => {
      if (demoMode) {
        userInteractedRef.current = true;
        setDemoMode(false);
        setHoveredId(null);
      }
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('mousedown', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [demoMode]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#000] text-[#9ca3af] font-['Inter',sans-serif] text-[14px] font-medium antialiased">
      {/* 240px wide Pure Black Sidebar with Signature Animated Navigation */}
      <Sidebar
        activeId={activeId}
        onSelect={(id: NavItemId) => {
          userInteractedRef.current = true;
          setActiveId(id);
          setHoveredId(null);
        }}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
        demoMode={demoMode}
        setDemoMode={(enabled: boolean) => {
          userInteractedRef.current = !enabled;
          setDemoMode(enabled);
          if (!enabled) setHoveredId(null);
        }}
        reducedMotion={reducedMotion}
      />

      {/* Main SaaS Dashboard Area to the right */}
      <Dashboard
        activeTab={activeId}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={() => setReducedMotion((prev) => !prev)}
        demoMode={demoMode}
        onToggleDemoMode={() => {
          userInteractedRef.current = demoMode;
          setDemoMode((prev) => !prev);
          if (demoMode) setHoveredId(null);
        }}
      />
    </div>
  );
}

export default App;
