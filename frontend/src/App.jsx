import { useState } from 'react';
import { AppProvider, useApp } from './AppContext';
import FloatingBackground from './components/FloatingBackground';
import Navbar from './components/Navbar';
import Auth from './pages/Auth';
import Home from './pages/Home';
import History from './pages/History';
import About from './pages/About';
import AdminPanel from './pages/AdminPanel';
import Dashboard from './pages/Dashboard';

const ThemedShell = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('QUERYBRIDGE_THEME') || 'dark');
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('QUERYBRIDGE_THEME', next);
    setTheme(next);
  };
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (theme === 'light') { root.classList.add('light'); root.classList.remove('dark'); }
    else { root.classList.add('dark'); root.classList.remove('light'); }
  }

  const { user, authChecking } = useApp();
  const [page, setPage] = useState('dashboard'); // dashboard | query | history | about | admin

  if (authChecking) {
    return (
      <div className="relative min-h-screen grid-overlay text-theme-text flex items-center justify-center">
        <FloatingBackground theme={theme} />
        <div className="relative z-10 glass-panel-cyan rounded-2xl px-8 py-6 text-center" data-testid="auth-loading">
          <p className="font-mono text-[11px] uppercase tracking-widest text-neon-cyan">
            Validating secure session...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <FloatingBackground theme={theme} />
        <Auth theme={theme} toggleTheme={toggleTheme} />
      </>
    );
  }

  const pageMap = {
    dashboard: <Dashboard onOpenQuery={() => setPage('query')} />,
    query: <Home />,
    history: <History />,
    about: <About />,
    admin: <AdminPanel />,
  };

  return (
    <div className="relative min-h-screen grid-overlay text-theme-text transition-colors duration-300">
      <FloatingBackground theme={theme} />
      <Navbar currentPage={page} setCurrentPage={setPage} theme={theme} toggleTheme={toggleTheme} />
      <main className="w-full relative z-10" data-testid="page-root">
        {pageMap[page] || pageMap.dashboard}
      </main>
      <footer className="w-full py-6 border-t border-theme-text/5 bg-theme-code/15 backdrop-blur-sm relative z-10 text-center font-mono text-[9px] text-theme-dim tracking-wider">
        © 2026 QUERYBRIDGE ENTERPRISE GATEWAY · MULTI-TENANT EDITION
      </footer>
    </div>
  );
};

const App = () => (
  <AppProvider>
    <ThemedShell />
  </AppProvider>
);

export default App;
