import { motion } from 'framer-motion';
import { RiCpuLine, RiDatabaseLine, RiServerLine, RiCodeBoxLine, RiDashboard3Line } from 'react-icons/ri';

const TECH_STACK = [
  {
    name: 'React 19 & Vite',
    role: 'Frontend OS Interface',
    icon: RiDashboard3Line,
    color: 'text-neon-cyan border-neon-cyan/25 hover:border-neon-cyan/60 bg-neon-cyan/5',
    desc: 'Compiles the user interfaces, handles zero-gravity coordinate physics, and displays real-time AST compiling steps.'
  },
  {
    name: 'Flask + ASGI',
    role: 'API Integration Bridge',
    icon: RiServerLine,
    color: 'text-[#4ade80] border-[#4ade80]/20 hover:border-[#4ade80]/50 bg-[#4ade80]/5',
    desc: 'Hosts the multi-tenant API, RBAC enforcement, audit logging, and access-request workflows. Encrypts every stored DB credential.'
  },
  {
    name: 'Ollama AI Core',
    role: 'SQL Translation Node',
    icon: RiCpuLine,
    color: 'text-neon-purple border-neon-purple/20 hover:border-neon-purple/50 bg-neon-purple/5',
    desc: 'Leverages offline neural network models (Llama-3, Qwen-2.5-Coder) to translate natural human prompts into valid ANSI SQL queries.'
  },
  {
    name: 'PostgreSQL 16',
    role: 'Relational Database Matrix',
    icon: RiDatabaseLine,
    color: 'text-[#38bdf8] border-[#38bdf8]/20 hover:border-[#38bdf8]/50 bg-[#38bdf8]/5',
    desc: 'Stores datasets, indexes information, and runs compiled SQL statements to return structured raw row results to the client.'
  }
];

const About = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
      
      {/* Title */}
      <div className="text-center mb-16 border-b border-theme-text/5 pb-8">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display font-black text-4xl text-theme-text tracking-wide">
            ARCHITECTURAL SPECIFICATIONS
          </h2>
          <p className="text-xs font-mono text-theme-dim mt-1 uppercase tracking-wider">
            Inside the AI-Powered natural language compilation grid
          </p>
        </motion.div>
      </div>

      {/* Main explanation text */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center mb-20">
        <motion.div
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="lg:col-span-3 space-y-6 text-left"
        >
          <div className="flex items-center gap-2">
            <RiCodeBoxLine className="text-xl text-neon-cyan" />
            <h3 className="font-display font-bold text-sm text-theme-text tracking-wider uppercase">
              The Mission of QueryBridge
            </h3>
          </div>
          
          <p className="text-theme-muted text-sm leading-relaxed font-sans">
            QueryBridge is an experimental prototype designed to bridge the friction gap between human expression and complex structured query languages. In traditional environments, extracting records requires writing syntax-perfect SQL code. QueryBridge converts colloquial sentences directly into optimized SQL scripts in milliseconds.
          </p>
          
          <p className="text-theme-muted text-sm leading-relaxed font-sans">
            Using zero-latency semantic translation, the core AI reasons about database table structures, identifies primary and foreign keys, writes complex joins, aggregates metrics, and executes the results securely. All operations are presented within a futuristic dashboard layout, allowing engineers and business teams to co-operate seamlessly.
          </p>

          <div className="p-4 bg-theme-text/5 border border-theme-text/5 rounded-xl">
            <span className="font-mono text-[9px] text-theme-dim uppercase tracking-widest block mb-1">
              Engine Feature List
            </span>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[10px] text-theme-muted">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan" /> Offline SQL Compiling
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan" /> Multi-Table Joins Resolution
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-purple" /> Interactive Result Exporting
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-purple" /> History Log Preservation
              </li>
            </ul>
          </div>
        </motion.div>

        {/* Visual Blueprint Diagram (Interconnected Modules) */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/10 relative overflow-hidden h-[300px] flex items-center justify-center"
        >
          {/* Radial bg shine */}
          <div className="absolute inset-0 bg-radial-gradient from-neon-cyan/5 via-transparent to-transparent opacity-60 pointer-events-none" />

          {/* Glowing Schematic SVG */}
          <svg className="w-full h-full absolute inset-0 p-4" viewBox="0 0 400 300">
            {/* SVG Connecting paths */}
            <path d="M 60 150 Q 200 50 200 150" fill="none" stroke="rgba(0, 240, 255, 0.25)" strokeWidth="1.5" strokeDasharray="4,4" />
            <path d="M 200 150 Q 200 250 340 150" fill="none" stroke="rgba(171, 0, 255, 0.25)" strokeWidth="1.5" strokeDasharray="4,4" />
            <line x1="60" y1="150" x2="200" y2="150" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" />
            <line x1="200" y1="150" x2="340" y2="150" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" />

            {/* Nodes */}
            <circle cx="60" cy="150" r="16" fill="#030014" stroke="#00f0ff" strokeWidth="2.5" className="animate-pulse" />
            <circle cx="200" cy="150" r="22" fill="#030014" stroke="#ab00ff" strokeWidth="2.5" />
            <circle cx="340" cy="150" r="16" fill="#030014" stroke="#38bdf8" strokeWidth="2.5" />

            {/* Text labels */}
            <text x="60" y="125" fill="var(--text-primary)" fontSize="9" fontFamily="Orbitron" textAnchor="middle" fontWeight="bold">REACT UI</text>
            <text x="200" y="115" fill="var(--text-primary)" fontSize="10" fontFamily="Orbitron" textAnchor="middle" fontWeight="bold">AI COMPILER</text>
            <text x="340" y="125" fill="var(--text-primary)" fontSize="9" fontFamily="Orbitron" textAnchor="middle" fontWeight="bold">DATABASE</text>
          </svg>
          
          <div className="absolute bottom-5 font-mono text-[9px] text-theme-dim text-center uppercase tracking-widest leading-relaxed">
            SYSTEM NODE FLOW:<br />
            <span className="text-neon-cyan font-bold">CLIENT</span> &gt;&gt; <span className="text-neon-purple font-bold">INFERENCE ENGINE</span> &gt;&gt; <span className="text-[#38bdf8] font-bold">POSTGRES TABLE SET</span>
          </div>
        </motion.div>
      </div>

      {/* Grid of tech cards */}
      <h3 className="font-display font-bold text-sm text-theme-text tracking-widest uppercase text-left mb-6">
        Technology Stack Details
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {TECH_STACK.map((tech, index) => {
          const Icon = tech.icon;
          return (
            <motion.div
              key={tech.name}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 + 0.3, duration: 0.6 }}
              whileHover={{ y: -5 }}
              className={`glass-panel border rounded-xl p-5 shadow-[0_5px_15px_rgba(0,0,0,0.2)] hover:shadow-[0_10px_20px_rgba(0,0,0,0.3)] transition-all duration-300 ${tech.color.split(' ')[1]}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${tech.color.split(' ')[0]} ${tech.color.split(' ')[3]}`}>
                  <Icon />
                </div>
                <div>
                  <h4 className="font-display font-bold text-xs text-theme-text uppercase tracking-wide">
                    {tech.name}
                  </h4>
                  <span className="font-mono text-[9px] text-theme-dim uppercase">
                    {tech.role}
                  </span>
                </div>
              </div>
              
              <p className="text-theme-muted text-[11px] leading-relaxed font-sans text-left">
                {tech.desc}
              </p>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
};

export default About;
