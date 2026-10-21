import React from 'react';

export default function Footer({ scrollToSection }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 dark:border-primary-900/30 pt-20 pb-10 relative z-10 bg-white dark:bg-[#0f0e15] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12 mb-16">
        <div className="md:col-span-1">
          <div className="flex items-center gap-3 mb-6 cursor-pointer" onClick={() => scrollToSection('home')}>
            <img 
              src="/logo.png" 
              alt="Quaders Logo" 
              className="w-auto h-10 md:h-12 object-contain hover:scale-105 transition-transform" 
            />
          </div>
          <p className="text-slate-500 dark:text-[#94a3b8] font-medium leading-relaxed">
            Empowering educational institutions globally with cutting-edge cloud management technology.
          </p>
        </div>
        
        <div>
          <h4 className="font-bold text-slate-900 dark:text-[#f1f5f9] mb-6 uppercase tracking-wider text-sm">Product</h4>
          <ul className="space-y-4 text-slate-500 dark:text-[#94a3b8] font-medium">
            <li>
              <button onClick={() => scrollToSection('services')} className="relative group inline-block hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
                Features
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary-500 transition-all duration-300 group-hover:w-full"></span>
              </button>
            </li>
            <li>
              <button onClick={() => scrollToSection('pricing')} className="relative group inline-block hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
                Pricing
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary-500 transition-all duration-300 group-hover:w-full"></span>
              </button>
            </li>
            <li>
              <button className="relative group inline-block hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
                Security
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary-500 transition-all duration-300 group-hover:w-full"></span>
              </button>
            </li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-bold text-slate-900 dark:text-[#f1f5f9] mb-6 uppercase tracking-wider text-sm">Company</h4>
          <ul className="space-y-4 text-slate-500 dark:text-[#94a3b8] font-medium">
            <li>
              <button className="relative group inline-block hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
                About Us
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary-500 transition-all duration-300 group-hover:w-full"></span>
              </button>
            </li>
            <li>
              <button className="relative group inline-block hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
                Careers
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary-500 transition-all duration-300 group-hover:w-full"></span>
              </button>
            </li>
            <li>
              <button className="relative group inline-block hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
                Contact
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary-500 transition-all duration-300 group-hover:w-full"></span>
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-[#f1f5f9] mb-6 uppercase tracking-wider text-sm">Stay Updated</h4>
          <p className="text-slate-500 dark:text-[#94a3b8] font-medium mb-4">Subscribe to our newsletter for the latest updates and features.</p>
          <form className="flex flex-col gap-2" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="Your email address" aria-label="Email address" className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-primary-900/50 text-slate-900 dark:text-[#f1f5f9] outline-none focus:border-primary-500 dark:focus:border-primary-400 focus:ring-1 focus:ring-primary-500 transition-all" required />
            <button type="submit" className="w-full px-4 py-3 bg-slate-800 dark:bg-[#1e293b] text-white font-bold rounded-xl hover:bg-slate-900 dark:hover:bg-[#f97316] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">Subscribe</button>
          </form>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-slate-200 dark:border-primary-900/20 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 dark:text-[#94a3b8] text-sm font-medium">
        <p>&copy; {currentYear} Quaders. All rights reserved.</p>
        <div className="flex gap-6">
          <button className="hover:text-primary-500 transition-colors">Privacy Policy</button>
          <button className="hover:text-primary-500 transition-colors">Terms of Service</button>
        </div>
      </div>
    </footer>
  );
}
