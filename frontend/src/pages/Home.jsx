import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RiDatabaseLine, RiCpuLine, RiNodeTree, RiBrainLine, RiMicLine, RiDownloadLine,
  RiFlashlightLine, RiSearchEyeLine, RiAlertLine, RiLockLine, RiShieldKeyholeLine,
} from 'react-icons/ri';
import InputBox from '../components/InputBox';
import QueryCard from '../components/QueryCard';
import ResultTable from '../components/ResultTable';
import Loader from '../components/Loader';
import { useApp } from '../AppContext';
import { generateQuery, getDatabaseSchema, requestAccess } from '../services/api';

const FEATURE_PILLS = [
  { icon: RiBrainLine, label: 'NLP → SQL', color: 'neon-cyan' },
  { icon: RiShieldKeyholeLine, label: 'RBAC Enforced', color: 'neon-purple' },
  { icon: RiFlashlightLine, label: 'Instant Execution', color: 'neon-cyan' },
  { icon: RiDownloadLine, label: 'CSV Export', color: 'neon-purple' },
  { icon: RiSearchEyeLine, label: 'Schema-Aware', color: 'neon-cyan' },
];

const ROLE_TONE = {
  admin:   'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/40',
  editor:  'bg-amber-400/10 text-amber-400 border-amber-400/40',
  analyst: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/40',
  viewer:  'bg-neon-purple/10 text-neon-purple border-neon-purple/40',
};

const Home = () => {
  const { activeWsId, databases, activeDb, setActiveDbId } = useApp();
  const [prompt, setPrompt] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [schema, setSchema] = useState([]);
  const [accessError, setAccessError] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const resultsRef = useRef(null);

  useEffect(() => {
    setQueryResult(null);
    setAccessError(null);
    setSchema([]);
    if (!activeDb || !activeWsId) return;
    getDatabaseSchema(activeWsId, activeDb.id).then(r => {
      if (r.success) setSchema(r.schema || []);
      else if (r.status === 403) setAccessError(r.payload || { message: r.error });
    });
  }, [activeDb, activeWsId]);

  const handleColumnClick = (colName) => {
    const clean = colName.replace(/\s*\(.*?\)/g, '').trim();
    setPrompt((prev) => {
      const trimmed = (prev || '').trimEnd();
      return trimmed ? `${trimmed} ${clean}` : clean;
    });
  };

  const handleSubmit = async (overridePrompt) => {
    if (!activeDb || !activeWsId) return;
    const activePrompt = (typeof overridePrompt === 'string' ? overridePrompt : prompt).trim();
    if (!activePrompt) return;
    setIsPending(true);
    setQueryResult(null);
    setShowTable(false);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    const r = await generateQuery(activeWsId, activeDb.id, activePrompt);
    setIsPending(false);
    if (r.success) {
      setQueryResult({
        success: true,
        query: activePrompt,
        sql: r.sql,
        columns: r.columns,
        rows: r.rows,
        latency: r.latency,
        tokensUsed: r.tokensUsed,
        database: r.database,
        mode: r.llm_mode === 'ollama' ? 'live' : 'simulated',
        classification: r.classification,
      });
    } else {
      const code = r.payload?.code;
      setQueryResult({
        success: false,
        query: activePrompt,
        error: r.error || 'Failed.',
        sql: r.payload?.sql || '',
        columns: [], rows: [],
        latency: r.payload?.latency || '—',
        tokensUsed: 0,
        database: activeDb.name,
        mode: 'blocked',
        code,
        classification: r.payload?.classification,
        approval: r.payload?.approval,
      });
    }
  };

  const handleTypingComplete = () => setTimeout(() => setShowTable(true), 1200);

  const requestAccessNow = async () => {
    if (!activeDb) return;
    setRequesting(true);
    const r = await requestAccess(activeWsId, activeDb.id, 'viewer', 'Auto-request from query workspace');
    setRequesting(false);
    if (r.success) setAccessError({ ...accessError, message: 'Access request submitted.', requested: true });
  };

  // No active database
  if (!activeDb) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center" data-testid="no-active-db">
        <RiDatabaseLine className="text-5xl text-theme-dim mx-auto mb-4" />
        <h2 className="font-display font-bold text-2xl text-theme-text mb-2">Pick a database to query</h2>
        <p className="text-theme-muted text-sm">
          Open the Dashboard and choose a registered database you have access to.
        </p>
      </div>
    );
  }

  // No access to selected db
  if (accessError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center" data-testid="db-access-denied">
        <RiLockLine className="text-5xl text-neon-purple mx-auto mb-4" />
        <h2 className="font-display font-bold text-2xl text-theme-text mb-2">Access Required</h2>
        <p className="text-theme-muted mb-6">{accessError.message || 'You do not currently have access to this database.'}</p>
        {!accessError.requested ? (
          <button onClick={requestAccessNow} disabled={requesting}
            data-testid="quick-request-access"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-neon-purple to-neon-blue text-white font-display font-bold uppercase tracking-widest text-sm">
            {requesting ? 'Submitting…' : 'Request Access'}
          </button>
        ) : (
          <p className="text-emerald-400 font-mono text-sm">Request submitted. Wait for admin approval.</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16" data-testid="query-workspace">
      {/* Header */}
      <div className="text-center mb-10">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <h1 className="font-display font-extrabold text-5xl md:text-7xl tracking-tight brand-title-main mb-3">
            QueryBridge
          </h1>
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="font-display text-xs md:text-sm text-theme-muted tracking-widest uppercase font-light mb-4">
          Querying <span className="text-neon-cyan">{activeDb.name}</span>
        </motion.p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-3" data-testid="active-db-info">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-widest border ${ROLE_TONE[activeDb.my_role] || ''}`}>
            <RiShieldKeyholeLine /> {activeDb.my_role || '—'}
          </span>
          <span className="px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-widest border bg-theme-text/5 border-theme-text/10 text-theme-muted">
            {activeDb.db_type} · {activeDb.database_name}
          </span>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap justify-center gap-2">
          {FEATURE_PILLS.map((pill, i) => {
            const Icon = pill.icon;
            const isCyan = pill.color === 'neon-cyan';
            return (
              <motion.div key={pill.label}
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-semibold border ${
                  isCyan ? 'bg-neon-cyan/5 border-neon-cyan/20 text-neon-cyan' : 'bg-neon-purple/5 border-neon-purple/20 text-neon-purple'
                }`}>
                <Icon className="text-xs" />
                <span>{pill.label}</span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* DB selector */}
      {databases.filter(d => d.my_role).length > 1 && (
        <div className="max-w-3xl mx-auto mb-8 flex items-center gap-3" data-testid="db-selector-row">
          <span className="font-mono text-[10px] uppercase text-theme-dim">Active DB:</span>
          <select value={activeDb.id} onChange={e => setActiveDbId(parseInt(e.target.value, 10))}
            data-testid="db-selector"
            className="bg-theme-input border border-theme-input-border rounded-lg px-3 py-2 text-sm flex-1">
            {databases.filter(d => d.my_role).map(d => <option key={d.id} value={d.id}>{d.name} ({d.my_role})</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start mb-16">
        {/* Schema sidebar */}
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="lg:col-span-1 glass-panel rounded-2xl p-5 border border-theme-text/5 shadow-[0_10px_20px_rgba(0,0,0,0.4)]"
          data-testid="schema-sidebar">
          <div className="flex items-center gap-2 border-b border-theme-text/10 pb-3 mb-4">
            <RiDatabaseLine className="text-neon-purple text-lg" />
            <h3 className="font-display font-bold text-xs text-theme-text tracking-wider uppercase">
              Authorized Schema
            </h3>
          </div>
          <div className="space-y-3">
            {schema.map((t) => (
              <div key={t.name} className="bg-theme-code/15 border border-theme-text/5 rounded-lg p-3 hover:border-neon-purple/20 transition-colors"
                   data-testid={`schema-table-${t.name}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs text-neon-purple font-semibold">{t.name}</span>
                  {typeof t.row_count !== 'undefined' && t.row_count >= 0 && (
                    <span className="font-mono text-[9px] text-theme-dim uppercase">{t.row_count} rows</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(t.columns || []).map((c) => {
                    const name = c.column_name || c.name || c;
                    const tag = c.is_pk ? ' (PK)' : c.is_fk ? ' (FK)' : '';
                    return (
                      <button key={name} onClick={() => handleColumnClick(name)}
                        title={`Insert "${name}"`}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-theme-text/5 text-theme-muted hover:!bg-neon-purple/20 hover:!text-neon-purple hover:border-neon-purple/30 border border-transparent transition-all cursor-pointer">
                        {name}{tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {schema.length === 0 && (
              <div className="text-center text-theme-muted text-[11px] font-mono py-4">
                No authorized tables.
              </div>
            )}
          </div>
          <div className="mt-5 pt-3 border-t border-theme-text/5 flex items-center justify-between font-mono text-[9px] text-theme-dim">
            <span className="flex items-center gap-1"><RiCpuLine className="text-neon-cyan" /> {activeDb.db_type}</span>
            <span className="flex items-center gap-1"><RiNodeTree className="text-neon-purple" /> {schema.length} TABLES</span>
          </div>
        </motion.div>

        <div className="lg:col-span-3">
          <InputBox value={prompt} onChange={setPrompt} onSubmit={handleSubmit} isPending={isPending} />
          <div ref={resultsRef} className="scroll-mt-10" />

          <AnimatePresence mode="wait">
            {isPending && (
              <motion.div key="loader" initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Loader />
              </motion.div>
            )}

            {!isPending && queryResult?.success && (
              <motion.div key="ok" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <QueryCard queryResult={queryResult} onTypingComplete={handleTypingComplete} />
                {showTable && <ResultTable queryResult={queryResult} />}
              </motion.div>
            )}

            {!isPending && queryResult && !queryResult.success && (
              <motion.div key="err" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-3xl mx-auto mt-8 glass-panel border border-red-500/30 rounded-2xl p-6"
                data-testid="query-error">
                <div className="flex items-center gap-3 border-b border-theme-text/10 pb-4 mb-4">
                  <RiAlertLine className="text-2xl text-red-400 animate-pulse" />
                  <div>
                    <h4 className="font-display font-bold text-sm text-theme-text uppercase">
                      {queryResult.code === 'PERMISSION_DENIED'  ? 'Permission Denied'
                       : queryResult.code === 'APPROVAL_REQUIRED' ? 'High-risk · Admin approval required'
                       : 'Query Refused'}
                    </h4>
                    <p className="text-[10px] font-mono text-theme-dim mt-0.5">
                      {queryResult.classification?.op || ''}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-theme-muted mb-3">{queryResult.error}</p>
                {queryResult.sql && (
                  <pre className="text-xs font-mono text-neon-cyan/90 bg-theme-code rounded p-3 overflow-x-auto">
                    {queryResult.sql}
                  </pre>
                )}
                {queryResult.classification?.reasons?.length > 0 && (
                  <ul className="mt-3 text-[11px] font-mono text-amber-400 list-disc pl-5">
                    {queryResult.classification.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Home;
