import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, MeshDistortMaterial } from '@react-three/drei';
import { LuChevronRight } from 'react-icons/lu';
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
            Quaders is the modern all-in-one ERP platform for schools. Manage student records, fees, attendance, examinations, and staff operations with real-time accuracy.
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
              onClick={() => scrollToSection('services')}
              className="w-full sm:w-auto px-7 py-4 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-bold text-base sm:text-lg rounded-full hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Explore Features</span>
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
