import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Float } from '@react-three/drei';
import { LuArrowRight } from 'react-icons/lu';

function OffscreenObject({ reducedMotion }) {
  const meshRef = useRef(null);

  useFrame((state) => {
    if (meshRef.current && !reducedMotion) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.1;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <Float speed={reducedMotion ? 0 : 1} rotationIntensity={reducedMotion ? 0 : 0.5} floatIntensity={reducedMotion ? 0 : 2}>
      {/* Positioned off to the right side */}
      <mesh ref={meshRef} position={[6, 0, -2]} scale={4}>
        <torusKnotGeometry args={[1, 0.4, 64, 16]} />
        <MeshDistortMaterial 
          color="#F97316"
          emissive="#F97316"
          emissiveIntensity={1.2}
          roughness={0.3}
          distort={reducedMotion ? 0 : 0.5} 
          speed={reducedMotion ? 0 : 1.5} 
          transparent
          opacity={0.8}
        />
      </mesh>
    </Float>
  );
}

export default function FinalCTA() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // Parallax the background slightly slower than the scroll
  const yParallax = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  useEffect(() => {
    const checkPerformance = () => {
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.innerWidth < 768);
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkPerformance();
    window.addEventListener('resize', checkPerformance);
    
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('resize', checkPerformance);
      observer.disconnect();
    };
  }, []);

  return (
    <section ref={containerRef} className="relative py-40 overflow-hidden bg-slate-900 dark:bg-black text-white">
      {/* Dramatic full-bleed gradient background */}
      <motion.div 
        style={{ y: yParallax }}
        className="absolute inset-0 bg-gradient-to-b from-primary-600 to-slate-900 dark:from-primary-900/50 dark:to-black opacity-40 pointer-events-none" 
      />

      {/* 3D Element Bleeding Off-screen */}
      {!reducedMotion && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-50">
          <Canvas camera={{ position: [0, 0, 10], fov: 45 }}>
            <ambientLight intensity={isDark ? 0.2 : 0.5} />
            <directionalLight position={[-10, 10, 10]} intensity={1} color="#F97316" />
            <OffscreenObject reducedMotion={reducedMotion} />
          </Canvas>
        </div>
      )}

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-7xl font-black mb-6 tracking-tight"
        >
          Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-white">transform</span> your school?
        </motion.h2>

        <motion.p 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl text-primary-100/70 max-w-2xl mx-auto mb-12"
        >
          Join hundreds of institutions already running on the ultimate educational operating system.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative inline-block"
        >
          {/* Continuous pulsing glow behind button */}
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-primary-500 rounded-full blur-xl z-0"
          />
          
          <button 
            onClick={() => navigate('/register')}
            className="relative z-10 px-10 py-5 bg-white text-primary-600 dark:bg-primary-500 dark:text-white font-black text-xl rounded-full hover:scale-105 transition-all flex items-center gap-3 mx-auto shadow-2xl hover:shadow-[0_0_40px_rgba(249,115,22,0.8)]"
          >
            Get Started For Free <LuArrowRight size={24} />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
