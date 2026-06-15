import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RiHistoryLine, RiDeleteBin5Line, RiFileCopyLine, RiCheckLine,
  RiStarLine, RiStarFill, RiSearchLine, RiPlayLine, RiDatabaseLine,
} from 'react-icons/ri';
import { useApp } from '../AppContext';
import { getHistory, toggleFavoriteHistory, deleteHistory, generateQuery } from '../services/api';

const History = () => {
  const { activeWsId, activeDb } = useApp();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [showFav, setShowFav] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [reRunBusy, setReRunBusy] = useState(false);

  const reload = async () => {
    const r = await getHistory({ q: search, favorite: showFav ? '1' : '' });
    if (r.success) setItems(r.history || []);
  };
  useEffect(() => { reload(); }, [search, showFav]);

  const copySql = (id, sql) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const reRun = async (item) => {
    if (!activeWsId || !item.db_id) return;
    setReRunBusy(true);
    await generateQuery(activeWsId, item.db_id, item.natural_prompt);
    setReRunBusy(false);
    reload();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16" data-testid="history-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-text/10 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan">
            <RiHistoryLine className="text-xl" />
          </div>
          <div>
            <h2 className="font-display font-black text-3xl text-theme-text tracking-wide">QUERY HISTORY</h2>
            <p className="text-xs font-mono text-theme-dim mt-1 uppercase tracking-wider">Server-side audit-aware history per account</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-dim" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              data-testid="history-search"
              placeholder="search prompts / sql"
              className="bg-theme-input border border-theme-input-border rounded-lg pl-9 pr-3 py-2 text-sm w-64" />
          </label>
          <button onClick={() => setShowFav(f => !f)}
            data-testid="history-fav-filter"
            className={`flex items-center gap-1 px-3 py-2 rounded-lg border text-xs font-mono ${
              showFav ? 'bg-amber-400/10 border-amber-400/40 text-amber-400' : 'bg-theme-text/5 border-theme-text/10 text-theme-muted'
            }`}>
            {showFav ? <RiStarFill /> : <RiStarLine />} Favorites
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-theme-text/2 border border-dashed border-theme-text/10 rounded-2xl max-w-xl mx-auto"
             data-testid="history-empty">
          <RiHistoryLine className="text-5xl text-theme-dim/50 mx-auto mb-4" />
          <h3 className="font-display font-bold text-lg text-theme-text mb-2">No history yet</h3>
          <p className="text-xs text-theme-muted">Run queries from the workspace to populate your history.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="glass-panel rounded-xl p-5 border border-theme-text/5 flex flex-col justify-between"
                data-testid={`history-card-${item.id}`}>
                <div>
                  <div className="flex items-center justify-between border-b border-theme-text/5 pb-3 mb-3 font-mono text-[9px] text-theme-dim">
                    <span className="flex items-center gap-1"><RiDatabaseLine className="text-neon-cyan" /> {item.db_name || 'db?'}</span>
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mb-3">
                    <span className="font-mono text-[9px] text-theme-dim block mb-1 uppercase tracking-wider">English Query</span>
                    <p className="text-sm text-theme-text leading-snug">"{item.natural_prompt}"</p>
                  </div>
                  <div className="bg-theme-code border border-theme-code-border rounded-lg p-3 mb-3 relative group">
                    <pre className="text-xs font-mono text-neon-cyan/90 overflow-x-auto whitespace-pre leading-relaxed select-all pr-8 max-h-24">
                      {item.generated_sql}
                    </pre>
                    <button onClick={() => copySql(item.id, item.generated_sql)}
                      className="absolute right-2 top-2 p-1.5 rounded bg-theme-text/5 border border-theme-text/10 hover:border-neon-cyan/40 text-[10px] text-theme-muted hover:text-neon-cyan"
                      data-testid={`history-copy-${item.id}`}>
                      {copiedId === item.id ? <RiCheckLine className="text-neon-cyan" /> : <RiFileCopyLine />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-theme-text/5 pt-3 mt-2">
                  <div className="font-mono text-[9px] text-theme-dim uppercase">
                    {item.row_count ?? '–'} rows · {item.execution_ms ?? '–'}ms
                    <span className={`ml-2 inline-block px-1.5 py-0.5 rounded border text-[8px] ${
                      item.success ? 'border-emerald-400/40 text-emerald-400' : 'border-red-400/40 text-red-400'
                    }`}>{item.success ? 'OK' : 'FAIL'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={async () => { await toggleFavoriteHistory(item.id); reload(); }}
                      data-testid={`history-fav-${item.id}`}
                      className={`p-2 rounded ${item.is_favorite ? 'text-amber-400' : 'text-theme-muted hover:text-amber-300'}`}>
                      {item.is_favorite ? <RiStarFill /> : <RiStarLine />}
                    </button>
                    <button onClick={async () => { await deleteHistory(item.id); reload(); }}
                      data-testid={`history-delete-${item.id}`}
                      className="p-2 rounded text-theme-muted hover:text-red-400">
                      <RiDeleteBin5Line />
                    </button>
                    <button onClick={() => reRun(item)} disabled={reRunBusy || !activeDb}
                      data-testid={`history-rerun-${item.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 rounded bg-gradient-to-r from-neon-cyan to-neon-blue text-black font-display font-bold text-[10px] disabled:opacity-60">
                      <RiPlayLine /> RERUN
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default History;
