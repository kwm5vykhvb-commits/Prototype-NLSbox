import React from 'react';
import { Tv, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface SplashScreenProps {
  statusText?: string;
  subText?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  statusText = 'Démarrage de NLSbox...',
  subText = 'Chargement de votre univers multimédia',
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0E] flex flex-col items-center justify-between p-6 sm:p-8 select-none overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-purple-700/10 via-red-600/10 to-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top spacer */}
      <div className="w-full flex items-center justify-end">
        <span className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase bg-white/5 border border-white/5 px-2.5 py-1 rounded-full">
          Haute Fidélité
        </span>
      </div>

      {/* Center Hero Brand Showcase */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col items-center text-center relative z-10 my-auto"
      >
        {/* Glowing Logo Icon */}
        <div className="relative mb-6">
          {/* Pulsing Aura */}
          <div className="absolute -inset-3 bg-gradient-to-r from-red-600 via-purple-600 to-indigo-600 rounded-3xl blur-xl opacity-50 animate-pulse" />

          {/* Logo Card */}
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-b from-[#1C1C26] to-[#121218] border border-white/15 shadow-2xl flex items-center justify-center overflow-hidden group">
            {/* Gloss Highlight */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/15 pointer-events-none" />

            <div className="relative flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/40">
                <Tv className="w-6 h-6 text-white stroke-[2.5]" />
              </div>
              <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute -top-1 -right-1 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
          </div>
        </div>

        {/* Brand Name Typography */}
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <div className="px-3 py-1 rounded-xl bg-gradient-to-r from-red-600 via-purple-600 to-indigo-600 shadow-md shadow-purple-950/50">
            <span className="font-black tracking-widest text-xl text-white uppercase">NLS</span>
          </div>
          <span className="font-black text-3xl text-white tracking-tight">
            box
          </span>
        </div>

        {/* Tagline */}
        <p className="text-xs font-medium text-gray-400 tracking-wider uppercase mb-8">
          Plateforme Multimédia & Streaming
        </p>

        {/* Sleek Gradient Loader Bar */}
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden relative shadow-inner mb-3">
          <motion.div
            className="absolute top-0 bottom-0 w-24 bg-gradient-to-r from-red-500 via-purple-500 to-indigo-400 rounded-full shadow-[0_0_12px_rgba(168,85,247,0.8)]"
            animate={{
              x: [-100, 200],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.4,
              ease: 'easeInOut',
            }}
          />
        </div>

        {/* Dynamic Status Text */}
        <p className="text-xs font-bold text-gray-200">
          {statusText}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {subText}
        </p>
      </motion.div>

      {/* Bottom Footer */}
      <div className="w-full flex items-center justify-center py-2 relative z-10">
        <span className="text-[10px] text-gray-400 font-medium">
          NLSbox Ecosystem • v2.5
        </span>
      </div>
    </div>
  );
};
