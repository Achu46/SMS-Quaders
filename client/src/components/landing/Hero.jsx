import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, MeshDistortMaterial } from '@react-three/drei';
import { LuChevronRight, LuMouse, LuSparkles as SparklesIcon, LuBot as BotIcon, LuArrowRight as ArrowRightIcon } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';

// 3D centerpiece: cluster of abstract shapes
function AbstractObject({ reducedMotion }) {
  const meshRef = useRef(null);
  
  useFrame((state) => {
    if (meshRef.current && !reducedMotion) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.15;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });

  return (
    <Float speed={reducedMotion ? 0 : 2} rotationIntensity={reducedMotion ? 0 : 1.5} floatIntensity={reducedMotion ? 0 : 2}>
      <mesh ref={meshRef} position={[0, 0, -2]} scale={1.2}>
        <icosahedronGeometry args={[2, 1]} />
        <MeshDistortMaterial 
          color="#F97316"
          emissive="#FB923C"
          emissiveIntensity={0.2}
          roughness={0.1}
          metalness={0.1}
          clearcoat={1}
          clearcoatRoughness={0.1}
          distort={reducedMotion ? 0 : 0.3} 
          speed={reducedMotion ? 0 : 2} 
          transparent
          opacity={0.15}
        />
      </mesh>
    </Float>
  );
}

export default function Hero({ scrollToSection }) {
  const navigate = useNavigate();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Mouse Parallax values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    // Check performance/viewport for fallback
    const checkPerformance = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.innerWidth < 768) {
        setReducedMotion(true);
      } else {
        setReducedMotion(false);
      }
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkPerformance();
    window.addEventListener('resize', checkPerformance);
    
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('resize', checkPerformance);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const handleMouseMove = (e) => {
      mouseX.set(e.clientX / window.innerWidth - 0.5);
      mouseY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY, reducedMotion]);

  // Gentle spring for mouse parallax on the Canvas container
  const springX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-20, 20]), { stiffness: 50, damping: 20 });
  const springY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-20, 20]), { stiffness: 50, damping: 20 });

  // Stagger variants
  const containerVars = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVars = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  const titleText = "Manage your school, at the speed of thought.".split(" ");

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center pt-24 pb-16 overflow-hidden bg-slate-50 dark:bg-[#020617] transition-colors duration-300">
      
      {/* Background Animated Gradient Blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-10">
        <motion.div 
          animate={{
            x: [0, 50, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/4 -right-1/4 w-full max-w-3xl h-[600px] bg-primary-300 dark:bg-primary-500 rounded-full blur-[150px]"
        />
        <motion.div 
          animate={{
            x: [0, -50, 0],
            y: [0, 50, 0],
            scale: [1, 1.3, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/4 -left-1/4 w-full max-w-2xl h-[500px] bg-primary-200 dark:bg-primary-600 rounded-full blur-[150px]"
        />
      </div>

      {/* 3D Canvas Background */}
      {!reducedMotion ? (
        <motion.div 
          className="absolute inset-0 z-10 pointer-events-none"
          style={{ x: springX, y: springY }}
        >
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
            <ambientLight intensity={isDarkMode ? 0.2 : 0.8} />
            <directionalLight position={[10, 10, 10]} intensity={1} color="#F97316" />
            <AbstractObject reducedMotion={reducedMotion} />
            {isDarkMode && <Sparkles count={150} scale={10} size={2} speed={0.4} color="#F97316" opacity={0.6} />}
          </Canvas>
        </motion.div>
      ) : (
        <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-br from-primary-400/10 to-transparent"></div>
      )}

      {/* Content */}
      <div className="relative z-20 text-center px-6 max-w-5xl mx-auto">
        <motion.div
          variants={containerVars}
          initial="hidden"
          animate="show"
        >
          {/* AI Feature Announcement Pill */}
          <motion.div 
            variants={itemVars} 
            onClick={() => scrollToSection('ai-assistant')}
            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/15 via-amber-500/15 to-orange-500/15 hover:from-orange-500/25 hover:to-amber-500/25 border border-orange-500/40 text-orange-600 dark:text-orange-400 text-xs sm:text-sm font-bold mb-6 shadow-md transition-all hover:scale-105"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <span>✨ Introducing AI Assistant: Real-Time Intelligence & Reports</span>
            <ArrowRightIcon size={14} className="text-orange-500" />
          </motion.div>

          <div className="flex flex-wrap justify-center gap-x-3 mb-6">
            {titleText.map((word, i) => (
              <motion.span 
                key={i} 
                variants={itemVars} 
                className={`text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.1] ${
                  i >= 3 ? "text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-300" : "text-slate-900 dark:text-white"
                }`}
              >
                {word}
              </motion.span>
            ))}
          </div>

          <motion.p
            variants={itemVars}
            className="text-lg lg:text-xl text-slate-600 dark:text-[#94a3b8] max-w-2xl mx-auto mb-8 leading-relaxed"
          >
            Quaders is the next-gen AI-powered ERP for schools. Ask anything about attendance, fees, or exam marks, and receive instant, live data answers with zero hallucination.
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            variants={itemVars}
            className="flex flex-col sm:flex-row gap-3.5 justify-center items-center mb-10"
          >
            <button 
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-400 text-white font-bold text-base sm:text-lg rounded-full hover:scale-105 hover:shadow-[0_0_40px_rgba(249,115,22,0.4)] transition-all duration-300 flex items-center justify-center gap-2"
            >
              Get Started <LuChevronRight size={20} />
            </button>
            <button 
              onClick={() => scrollToSection('ai-assistant')}
              className="w-full sm:w-auto px-7 py-4 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 hover:from-orange-500/20 hover:to-amber-500/20 border border-orange-500/40 text-orange-600 dark:text-orange-400 font-bold text-base sm:text-lg rounded-full hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
            >
              <SparklesIcon size={18} className="text-orange-500" />
              <span>Explore AI Assistant</span>
            </button>
          </motion.div>

          {/* Hero AI Quick Query Preview Bar */}
          <motion.div
            variants={itemVars}
            onClick={() => scrollToSection('ai-assistant')}
            className="cursor-pointer max-w-2xl mx-auto p-3.5 sm:p-4 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl hover:shadow-2xl hover:border-orange-500/40 transition-all text-left group"
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-sm">
                  <BotIcon size={15} />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Ask AI Anything about your school records:
                </span>
              </div>
              <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Live Demo <ArrowRightIcon size={12} />
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 transition-colors">
                💬 "How many students are absent today?"
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 transition-colors">
                💬 "Which students have pending fees?"
              </span>
              <span className="hidden sm:inline-block px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 transition-colors">
                💬 "Class 10 exam rankings"
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>
      
      {/* Scroll Cue */}
      <motion.div 
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-primary-500 dark:text-primary-400 opacity-60 z-20 cursor-pointer"
        onClick={() => scrollToSection('ai-assistant')}
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      >
        <LuMouse size={24} />
      </motion.div>
    </section>
  );
}
