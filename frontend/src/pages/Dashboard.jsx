import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  RiDatabase2Line, RiShieldKeyholeLine, RiLockLine, RiArrowRightLine,
  RiCheckLine, RiTimeLine, RiCloseLine, RiSparklingLine, RiUserStarLine,
} from 'react-icons/ri';
import { useApp } from '../AppContext';
import { listAccessRequests, requestAccess } from '../services/api';

const ROLE_TONE = {
  admin:   'border-neon-cyan/50 text-neon-cyan bg-neon-cyan/10',
  editor:  'border-amber-400/50 text-amber-400 bg-amber-400/10',
  analyst: 'border-emerald-400/50 text-emerald-400 bg-emerald-400/10',
  viewer:  'border-neon-purple/50 text-neon-purple bg-neon-purple/10',
};

const RoleBadge = ({ role }) => (
  <span data-testid={`role-badge-${role || 'none'}`}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-widest border ${
      ROLE_TONE[role] || 'border-red-500/40 text-red-400 bg-red-500/10'
    }`}>
    {role ? <RiShieldKeyholeLine /> : <RiLockLine />} {role || 'no access'}
  </span>
);

const Dashboard = ({ onOpenQuery }) => {
  const {
    user, isPlatformAdmin, isWorkspaceAdmin,
    activeWorkspace, activeWsId, databases, setActiveDbId,
    refreshDatabases,
  } = useApp();

  const [requestModal, setRequestModal] = useState(null); // db object
  const [reqRole, setReqRole] = useState('viewer');
  const [reqReason, setReqReason] = useState('');
  const [reqStatus, setReqStatus] = useState(null);
  const [myRequests, setMyRequests] = useState([]);

  const loadRequests = async () => {
    if (!activeWsId) return;
    const r = await listAccessRequests(activeWsId);
    if (r.success) setMyRequests(r.requests || []);
  };

  useEffect(() => { loadRequests(); }, [activeWsId]);

  const handleOpenDb = (db) => {
    if (!db.my_role && !isPlatformAdmin) {
      setRequestModal(db); setReqRole('viewer'); setReqReason(''); setReqStatus(null);
      return;
    }
    setActiveDbId(db.id);
    onOpenQuery?.();
  };

  const submitRequest = async () => {
    if (!requestModal) return;
    setReqStatus('pending');
    const r = await requestAccess(activeWsId, requestModal.id, reqRole, reqReason);
    setReqStatus(r.success ? 'sent' : 'error');
    if (r.success) { await loadRequests(); }
  };

  const pendingForDb = (dbId) =>
    myRequests.find(r => r.db_id === dbId && r.user_id === user?.id && r.status === 'pending');

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
      {/* Hero */}
      <div className="mb-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-neon-cyan mb-2">
              Welcome back · {user?.name}
            </p>
            <h1 className="font-display font-extrabold text-4xl md:text-5xl text-theme-text brand-title-main">
              {activeWorkspace?.name || 'No workspace selected'}
            </h1>
            <p className="text-theme-muted mt-2 max-w-xl">
              Browse the databases registered in this workspace. Open one you have
              access to, or request access from a workspace admin.
            </p>
          </motion.div>
        </div>
        <div className="flex flex-wrap gap-3">
          {isWorkspaceAdmin && (
            <button
              data-testid="goto-admin-btn"
              onClick={() => window.dispatchEvent(new CustomEvent('qb-goto', { detail: 'admin' }))}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-purple to-neon-blue text-white font-display font-bold text-xs uppercase tracking-wider hover:shadow-[0_0_25px_rgba(171,0,255,0.4)] transition-all"
              hidden /* hide CTA – use Navbar Admin tab */
            >
              Admin Panel
            </button>
          )}
        </div>
      </div>

      {/* DB Grid */}
      {databases.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center border border-dashed border-theme-text/10"
             data-testid="no-databases">
          <RiDatabase2Line className="text-5xl text-theme-dim mx-auto mb-3" />
          <h3 className="font-display font-bold text-lg text-theme-text">No databases yet</h3>
          <p className="text-theme-muted mt-1 text-sm">
            {isWorkspaceAdmin
              ? 'Open the Admin Panel to register your first database.'
              : 'A workspace admin must register databases first.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="database-grid">
          {databases.map((db) => {
            const pending = pendingForDb(db.id);
            return (
              <motion.div
                key={db.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                className={`glass-panel rounded-2xl p-5 border shadow-[0_5px_15px_rgba(0,0,0,0.3)] transition-all relative ${
                  db.my_role ? 'border-neon-cyan/25 hover:border-neon-cyan/55' : 'border-theme-text/10 hover:border-neon-purple/40'
                }`}
                data-testid={`db-card-${db.id}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                      db.my_role ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30'
                                  : 'bg-theme-text/5 text-theme-muted border border-theme-text/10'
                    }`}>
                      <RiDatabase2Line />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm text-theme-text">{db.name}</h3>
                      <p className="font-mono text-[10px] text-theme-dim uppercase tracking-widest">
                        {db.db_type} · {db.host}:{db.port}
                      </p>
                    </div>
                  </div>
                  <RoleBadge role={db.my_role} />
                </div>

                <p className="text-theme-muted text-xs leading-relaxed mb-4 min-h-[2.5em] line-clamp-2">
                  {db.description || 'No description provided.'}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4 font-mono text-[10px] text-theme-dim">
                  <div className="flex items-center gap-1">
                    <RiSparklingLine className="text-neon-cyan" /> tables: {db.schema_cache?.length || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <RiUserStarLine className="text-neon-purple" /> db: {db.database_name}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-theme-text/5">
                  <span className="font-mono text-[9px] text-theme-dim">
                    {db.schema_synced_at ? `synced ${new Date(db.schema_synced_at).toLocaleString()}` : 'never synced'}
                  </span>
                  {db.my_role ? (
                    <button
                      onClick={() => handleOpenDb(db)}
                      data-testid={`open-db-${db.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-neon-cyan to-neon-blue text-black font-display font-bold text-[10px] hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                    >
                      OPEN QUERY <RiArrowRightLine />
                    </button>
                  ) : pending ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400" data-testid={`db-pending-${db.id}`}>
                      <RiTimeLine /> REQUEST PENDING
                    </span>
                  ) : (
                    <button
                      onClick={() => handleOpenDb(db)}
                      data-testid={`request-db-${db.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-text/5 hover:bg-neon-purple/15 border border-theme-text/10 hover:border-neon-purple/40 text-[10px] font-mono text-neon-purple"
                    >
                      <RiLockLine /> REQUEST ACCESS
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Access Request Modal */}
      {requestModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" data-testid="access-request-modal">
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            className="glass-panel-purple rounded-2xl p-7 max-w-md w-full border border-neon-purple/40 relative"
          >
            <button
              onClick={() => setRequestModal(null)}
              className="absolute top-3 right-3 text-theme-muted hover:text-red-400"
              data-testid="close-request-modal"
            >
              <RiCloseLine className="text-2xl" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-neon-purple/15 border border-neon-purple/40 flex items-center justify-center text-neon-purple">
                <RiLockLine className="text-xl" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-theme-text">Access Restricted</h3>
                <p className="text-[10px] font-mono text-theme-dim uppercase tracking-widest">DB · {requestModal.name}</p>
              </div>
            </div>
            <p className="text-theme-muted text-sm leading-relaxed mb-5">
              You do not currently have access to this database. Submit a request and a workspace administrator will review it.
            </p>

            <label className="block mb-3">
              <span className="block font-mono text-[10px] text-theme-muted uppercase mb-1">Requested Role</span>
              <select value={reqRole} onChange={(e) => setReqRole(e.target.value)}
                data-testid="request-role-select"
                className="w-full bg-theme-input border border-theme-input-border rounded-lg px-3 py-2 text-sm">
                <option value="viewer">Viewer (read only)</option>
                <option value="analyst">Analyst (read + analytics)</option>
                <option value="editor">Editor (SELECT/INSERT/UPDATE)</option>
                <option value="admin">Admin (full)</option>
              </select>
            </label>
            <label className="block mb-5">
              <span className="block font-mono text-[10px] text-theme-muted uppercase mb-1">Reason (optional)</span>
              <textarea value={reqReason} onChange={(e) => setReqReason(e.target.value)} rows={3}
                data-testid="request-reason"
                className="w-full bg-theme-input border border-theme-input-border rounded-lg px-3 py-2 text-sm"
                placeholder="Why do you need access?" />
            </label>

            {reqStatus === 'sent' && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-mono px-3 py-2 mb-3 flex items-center gap-2"
                   data-testid="request-success">
                <RiCheckLine /> Access request submitted.
              </div>
            )}
            {reqStatus === 'error' && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 text-xs font-mono px-3 py-2 mb-3">
                Could not submit request. Try again.
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => setRequestModal(null)}
                data-testid="cancel-request-btn"
                className="px-4 py-2 rounded-lg bg-theme-text/5 border border-theme-text/10 text-theme-muted hover:text-theme-text text-xs font-mono uppercase">
                Cancel
              </button>
              <button onClick={submitRequest} disabled={reqStatus === 'sent'}
                data-testid="submit-request-btn"
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-neon-purple to-neon-blue text-white text-xs font-display font-bold uppercase tracking-widest disabled:opacity-50">
                Request Access
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
