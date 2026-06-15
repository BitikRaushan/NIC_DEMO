import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  RiDashboardLine, RiTerminalBoxLine, RiHistoryLine, RiInformationLine,
  RiShieldUserLine, RiSunLine, RiMoonLine, RiLogoutCircleRLine, RiBuilding2Line, RiArrowDownSLine,
} from 'react-icons/ri';
import logo from '../assets/logo.svg';
import { useApp } from '../AppContext';
import { createWorkspace } from '../services/api';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: RiDashboardLine },
  { id: 'query', label: 'Query', icon: RiTerminalBoxLine },
  { id: 'history', label: 'History', icon: RiHistoryLine },
  { id: 'admin', label: 'Admin', icon: RiShieldUserLine, adminOnly: true },
  { id: 'about', label: 'About', icon: RiInformationLine },
];

const Navbar = ({ currentPage, setCurrentPage, theme, toggleTheme }) => {
  const {
    user, handleLogout, workspaces, activeWorkspace, setActiveWs,
    refreshWorkspaces, isWorkspaceAdmin, isPlatformAdmin,
  } = useApp();
  const [wsOpen, setWsOpen] = useState(false);
  const [creatingWs, setCreatingWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');

  const handleCreateWs = async () => {
    if (!newWsName.trim()) return;
    const r = await createWorkspace(newWsName.trim(), '');
    if (r.success) {
      setNewWsName('');
      setCreatingWs(false);
      setWsOpen(false);
      await refreshWorkspaces();
      setActiveWs(r.workspace.id);
    }
  };

  const adminAvailable = isWorkspaceAdmin || isPlatformAdmin;

  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 left-0 w-full z-40 px-4 md:px-8 py-4 backdrop-blur-md border-b border-theme-text/5 bg-space-dark/65"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setCurrentPage('dashboard')}
          data-testid="brand-home"
        >
          <motion.img src={logo} alt="QueryBridge" className="w-8 h-8"
            animate={{ rotate: 360 }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} />
          <div className="flex flex-col">
            <span className="font-display font-extrabold text-xl tracking-wider brand-title-navbar">
              QueryBridge
            </span>
            <span className="text-[9px] text-theme-muted font-mono tracking-widest -mt-1 uppercase">
              Enterprise · AI SQL Gateway
            </span>
          </div>
        </div>

        {/* Workspace switcher */}
        <div className="relative">
          <button
            onClick={() => setWsOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-text/5 hover:bg-neon-purple/10 border border-theme-text/10 hover:border-neon-purple/40 text-[11px] font-mono text-theme-text transition-all cursor-pointer"
            data-testid="workspace-switcher"
          >
            <RiBuilding2Line className="text-neon-purple" />
            <span className="max-w-40 truncate">
              {activeWorkspace?.name || 'No workspace'}
            </span>
            <RiArrowDownSLine />
          </button>
          {wsOpen && (
            <div className="absolute mt-2 right-0 w-72 glass-panel rounded-xl border border-theme-text/10 shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-50 p-2"
                 data-testid="workspace-dropdown">
              <div className="max-h-64 overflow-y-auto">
                {workspaces.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => { setActiveWs(w.id); setWsOpen(false); }}
                    className={`w-full text-left flex flex-col px-3 py-2 rounded-lg hover:bg-neon-purple/10 ${
                      w.id === activeWorkspace?.id ? 'bg-neon-purple/15 border border-neon-purple/30' : ''
                    }`}
                    data-testid={`workspace-option-${w.id}`}
                  >
                    <span className="font-display font-bold text-sm text-theme-text truncate">{w.name}</span>
                    <span className="font-mono text-[9px] text-theme-dim uppercase tracking-widest">{w.slug}</span>
                  </button>
                ))}
                {workspaces.length === 0 && (
                  <div className="text-center font-mono text-[10px] text-theme-dim py-4">No workspaces yet</div>
                )}
              </div>
              <div className="border-t border-theme-text/10 mt-2 pt-2">
                {!creatingWs ? (
                  <button
                    onClick={() => setCreatingWs(true)}
                    className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-mono text-neon-cyan hover:bg-neon-cyan/10"
                    data-testid="new-workspace-btn"
                  >
                    + Create new workspace
                  </button>
                ) : (
                  <div className="flex gap-2 px-2 pb-1">
                    <input
                      autoFocus
                      value={newWsName}
                      onChange={(e) => setNewWsName(e.target.value)}
                      placeholder="Workspace name"
                      className="flex-1 bg-theme-input border border-theme-input-border rounded px-2 py-1 text-xs"
                      data-testid="new-workspace-input"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateWs()}
                    />
                    <button onClick={handleCreateWs}
                      className="bg-neon-cyan text-black font-bold text-[10px] px-2 rounded"
                      data-testid="new-workspace-confirm">Add</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-theme-text/5 border border-theme-text/5 rounded-full p-1.5">
          {NAV.filter(n => !n.adminOnly || adminAvailable).map(({ id, label, icon: Icon }) => {
            const active = currentPage === id;
            return (
              <button
                key={id}
                onClick={() => setCurrentPage(id)}
                data-testid={`nav-${id}`}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-full font-display text-xs font-semibold transition-all ${
                  active ? 'text-theme-text bg-neon-cyan/10 border border-neon-cyan/40' : 'text-theme-muted hover:text-theme-text hover:bg-theme-text/5'
                }`}
              >
                <Icon className="text-base" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden lg:flex items-center gap-2 bg-theme-text/5 border border-theme-text/10 rounded-lg px-3 py-1.5 font-mono text-[10px] text-theme-muted">
              <RiShieldUserLine className="text-neon-cyan" />
              <span className="max-w-32 truncate" data-testid="current-user">{user.name}</span>
              {isPlatformAdmin && <span className="text-[8px] text-neon-purple font-bold uppercase">P-ADMIN</span>}
            </div>
          )}
          <button onClick={toggleTheme}
            className="p-2.5 rounded-lg bg-theme-text/5 hover:bg-neon-cyan/10 border border-theme-text/10 hover:border-neon-cyan/40 text-theme-text/80 hover:text-neon-cyan cursor-pointer"
            data-testid="toggle-theme-btn"
            title="Toggle theme">
            {theme === 'dark' ? <RiSunLine /> : <RiMoonLine />}
          </button>
          <button onClick={handleLogout}
            className="p-2.5 rounded-lg bg-theme-text/5 hover:bg-red-500/10 border border-theme-text/10 hover:border-red-400/40 text-theme-text/80 hover:text-red-300 cursor-pointer"
            data-testid="logout-btn"
            title="Logout">
            <RiLogoutCircleRLine />
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="flex md:hidden justify-center items-center gap-6 mt-4 pt-3 border-t border-theme-text/5">
        {NAV.filter(n => !n.adminOnly || adminAvailable).map(({ id, label, icon: Icon }) => {
          const active = currentPage === id;
          return (
            <button key={id} onClick={() => setCurrentPage(id)}
              data-testid={`nav-mobile-${id}`}
              className={`flex flex-col items-center gap-1 text-[11px] font-semibold font-display ${
                active ? 'text-neon-cyan' : 'text-theme-muted'
              }`}>
              <Icon className="text-lg" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </motion.header>
  );
};

export default Navbar;
