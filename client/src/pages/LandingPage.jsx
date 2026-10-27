import React, { useEffect, useState } from 'react';
import Nav from '../components/landing/Nav';
import Hero from '../components/landing/Hero';
import TrustBar from '../components/landing/TrustBar';
import CoreWorkflows from '../components/landing/CoreWorkflows';
import Pricing from '../components/landing/Pricing';
import WhyQuaders from '../components/landing/WhyQuaders';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/landing/Footer';

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auto-detect system preference for dark mode initially if no class is set
  useEffect(() => {
    if (!document.documentElement.classList.contains('dark') && !document.documentElement.classList.contains('light')) {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        // We will default to dark mode anyway for this design, but it's good practice.
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  const scrollToSection = (id) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-[#f1f5f9] font-sans selection:bg-primary-500 selection:text-white overflow-x-hidden transition-colors duration-300">
      <Nav scrollToSection={scrollToSection} />
      
      <main>
        <Hero scrollToSection={scrollToSection} />
        <TrustBar />
        <CoreWorkflows />
        <Pricing />
        <WhyQuaders />
        <FinalCTA />
      </main>

      <Footer scrollToSection={scrollToSection} />
    </div>
  );
}
