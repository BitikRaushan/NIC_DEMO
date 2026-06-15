import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RiSettings3Line } from 'react-icons/ri';

const SYSTEM_LOGS = [
  "CONNECTING TO QUERYBRIDGE ENGINE CORPS...",
  "PARSING LEXICAL SEMANTICS...",
  "RESOLVING DATABASE DATABASE_RECORDS BINDINGS...",
  "QUERYING OLLAMA GENERATIVE MODEL...",
  "DETERMINING SCHEMATIC CARDINALITIES...",
  "GENERATING DYNAMIC POSTGRES COMPILATION...",
  "TESTING AST VALIDITY PROTOCOLS...",
  "ESTABLISHING RELATIONAL OUTPUT STREAM..."
];

const Loader = () => {
  const [logs, setLogs] = useState([`[SYSTEM] INIT: ${SYSTEM_LOGS[0]}`]);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (currentStep >= SYSTEM_LOGS.length) return;

    const interval = setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        `[SYSTEM] OK: ${SYSTEM_LOGS[currentStep]}`
      ]);
      setCurrentStep((c) => c + 1);
    }, 450); // add a log every 450ms

    return () => clearTimeout(interval);
  }, [currentStep]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-3xl mx-auto mt-8 glass-panel rounded-2xl p-8 border border-neon-cyan/20 shadow-[0_0_30px_rgba(0,240,255,0.05)] text-center relative overflow-hidden"
    >
      {/* Decorative scanner lines */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-cyan/5 to-transparent h-1/2 w-full animate-pulse-slow pointer-events-none" />

      {/* Orbit / Scanner Ring */}
      <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
        {/* Outer Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full border-2 border-dashed border-neon-cyan/40"
        />
        {/* Inner Ring */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="absolute w-20 h-20 rounded-full border border-neon-purple/50 border-t-2 border-t-neon-purple"
        />
        {/* Central Core */}
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.6)]"
        >
          <RiSettings3Line className="text-xl text-black animate-spin" style={{ animationDuration: '4s' }} />
        </motion.div>
      </div>

      {/* Subtext */}
      <h3 className="font-display font-semibold text-lg text-white tracking-widest uppercase mb-1">
        Translating Prompt
      </h3>
      <p className="text-xs font-mono text-neon-cyan/70 tracking-wider mb-6 animate-pulse uppercase">
        Synthesizing SQL AST...
      </p>

      {/* System Console Logs */}
      <div className="w-full bg-[#02000c]/85 border border-white/5 rounded-xl p-4 text-left font-mono text-[10px] text-white/50 space-y-1.5 h-36 overflow-y-auto scrollbar-thin">
        {logs.map((log, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`${log.includes('SYSTEM') ? 'text-neon-cyan/80' : 'text-white/60'}`}
          >
            {log}
          </motion.div>
        ))}
        {/* Typing cursor */}
        <div className="flex items-center gap-1">
          <span className="text-neon-purple font-bold">&gt;&gt;</span>
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ repeat: Infinity, duration: 0.6 }}
            className="inline-block w-1.5 h-3 bg-neon-purple"
          />
        </div>
      </div>
    </motion.div>
  );
};

export default Loader;
