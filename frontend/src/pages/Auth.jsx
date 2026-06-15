import { useState } from 'react';
import { motion } from 'framer-motion';
import { RiLockPasswordLine, RiLoginCircleLine, RiMailLine, RiShieldUserLine, RiUserAddLine, RiUserLine } from 'react-icons/ri';
import logo from '../assets/logo.svg';
import { loginUser, registerUser } from '../services/api';
import { useApp } from '../AppContext';

const Auth = ({ theme, toggleTheme }) => {
  const { setUser } = useApp();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const result = isRegister
      ? await registerUser(form)
      : await loginUser({ email: form.email, password: form.password });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setUser(result.user);
  };
 

  return (
    <div className="relative min-h-screen grid-overlay text-theme-text transition-colors duration-300">
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-8 items-stretch"
        >
          <section className="glass-panel-cyan rounded-2xl p-7 md:p-10 flex flex-col justify-between min-h-[520px]">
            <div>
              <div className="flex items-center gap-3 mb-12">
                <img src={logo} alt="QueryBridge Logo" className="w-10 h-10" />
                <div>
                  <h1 className="font-display font-extrabold text-2xl tracking-wider brand-title-navbar">
                    QueryBridge
                  </h1>
                  <p className="font-mono text-[10px] text-theme-muted tracking-widest uppercase">
                    Secure SQL Translation Core
                  </p>
                </div>
              </div>

              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-neon-cyan/25 bg-neon-cyan/5 text-neon-cyan font-mono text-[10px] tracking-widest uppercase mb-5">
                  <RiShieldUserLine />
                  Auth Gateway
                </div>
                <h2 className="font-display font-extrabold text-4xl md:text-5xl leading-tight mb-5">
                  Sign in before opening the bridge.
                </h2>
                <p className="text-theme-muted text-sm md:text-base leading-7">
                  Your query workspace now starts behind an authenticated session. Register once, then continue into the same natural-language SQL interface with your bearer token attached automatically.
                </p>
              </div>
            </div>

            <div className="mt-10 border-t border-theme-text/10 pt-5">
              <p className="font-mono text-[10px] text-theme-dim uppercase tracking-widest">
                QueryBridge access layer
              </p>
            </div>
          </section>

          <section className="glass-panel-purple rounded-2xl p-6 md:p-8">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <p className="font-mono text-[10px] text-theme-muted uppercase tracking-widest mb-1">
                  Account Access
                </p>
                <h2 className="font-display text-2xl font-bold text-theme-text">
                  {isRegister ? 'Create account' : 'Welcome back'}
                </h2>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="px-3 py-2 rounded-lg border border-theme-text/10 text-theme-muted hover:text-theme-text hover:border-neon-cyan/40 transition-colors font-mono text-[10px] uppercase"
              >
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-theme-text/5 border border-theme-text/10 mb-7">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 font-display text-xs font-bold transition-all ${
                  !isRegister ? 'bg-neon-cyan text-black' : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <RiLoginCircleLine />
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 font-display text-xs font-bold transition-all ${
                  isRegister ? 'bg-neon-purple text-white' : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <RiUserAddLine />
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {isRegister && (
                <label className="block">
                  <span className="block font-mono text-[11px] text-theme-muted tracking-wider mb-2 uppercase">Name</span>
                  <div className="relative">
                    <RiUserLine className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-dim" />
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="w-full bg-theme-input border border-theme-input-border rounded-xl py-3 pl-10 pr-3 text-sm text-theme-text focus:outline-none focus:border-neon-cyan transition-colors"
                      placeholder="Ada Lovelace"
                      required
                    />
                  </div>
                </label>
              )}

              <label className="block">
                <span className="block font-mono text-[11px] text-theme-muted tracking-wider mb-2 uppercase">Email</span>
                <div className="relative">
                  <RiMailLine className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-dim" />
                  <input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      data-testid="auth-email"
                      className="w-full bg-theme-input border border-theme-input-border rounded-xl py-3 pl-10 pr-3 text-sm text-theme-text focus:outline-none focus:border-neon-cyan transition-colors"
                      placeholder="you@example.com"
                      required
                  />
                </div>
              </label>


              <label className="block">
                <span className="block font-mono text-[11px] text-theme-muted tracking-wider mb-2 uppercase">Password</span>
                <div className="relative">
                  <RiLockPasswordLine className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-dim" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    data-testid="auth-password"
                    className="w-full bg-theme-input border border-theme-input-border rounded-xl py-3 pl-10 pr-3 text-sm text-theme-text focus:outline-none focus:border-neon-cyan transition-colors"
                    placeholder="At least 8 characters"
                    minLength={isRegister ? 8 : undefined}
                    required
                  />
                </div>
              </label>

              {error && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="auth-submit-btn"
                className="w-full rounded-xl bg-gradient-to-r from-neon-cyan to-neon-blue py-3.5 text-sm font-display font-extrabold text-black transition-all hover:shadow-[0_0_24px_rgba(0,240,255,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Authenticating...' : isRegister ? 'Create Secure Account' : 'Enter QueryBridge'}
              </button>
            </form>

            <div className="mt-6 border-t border-theme-text/10 pt-4 font-mono text-[9px] text-theme-dim leading-relaxed" data-testid="demo-creds">
              <p className="uppercase tracking-widest text-theme-muted mb-1">Demo credentials</p>
              <p>admin@querybridge.dev / Admin@12345 (platform admin)</p>
              <p>analyst@querybridge.dev / Analyst@12345 (analyst)</p>
              <p>viewer@querybridge.dev / Viewer@12345 (viewer · no DB access)</p>
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
