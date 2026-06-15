import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RiFileCopyLine, RiCheckLine, RiTerminalBoxLine, RiTimerLine, RiCpuLine } from 'react-icons/ri';

const SQL_KEYWORDS = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|IN|IS|NULL|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|DROP|ALTER|ADD|COLUMN|PRIMARY|KEY|FOREIGN|REFERENCES|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|LIKE|BETWEEN|EXISTS|UNION|ALL|ASC|DESC|WITH|RETURNING)\b/g;
const SQL_STRINGS = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g;
const SQL_NUMBERS = /\b(\d+(?:\.\d+)?)\b/g;
const SQL_COMMENTS = /(--[^\n]*|\/\*[\s\S]*?\*\/)/g;
const SQL_OPERATORS = /([=<>!]+|[,;()])/g;

function highlightSQL(sql) {
  // We tokenize by splitting on the patterns to preserve positions
  const tokens = [];

  // Build a combined regex — order matters: comments first, then strings, keywords, numbers, operators
  const combined = new RegExp(
    [
      SQL_COMMENTS.source,
      SQL_STRINGS.source,
      SQL_KEYWORDS.source,
      SQL_NUMBERS.source,
      SQL_OPERATORS.source,
    ].join('|'),
    'g'
  );

  let match;
  let lastIndex = 0;

  while ((match = combined.exec(sql)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'plain', value: sql.slice(lastIndex, match.index) });
    }

    const val = match[0];
    if (/^(--)|(\/\*)/.test(val)) {
      tokens.push({ type: 'comment', value: val });
    } else if (/^['"]/.test(val)) {
      tokens.push({ type: 'string', value: val });
    } else if (SQL_KEYWORDS.test(val) && /^[A-Z]/.test(val)) {
      tokens.push({ type: 'keyword', value: val });
    } else if (/^\d/.test(val)) {
      tokens.push({ type: 'number', value: val });
    } else {
      tokens.push({ type: 'operator', value: val });
    }

    lastIndex = match.index + val.length;
  }

  // Reset lastIndex since we reused the regex object
  SQL_KEYWORDS.lastIndex = 0;

  if (lastIndex < sql.length) {
    tokens.push({ type: 'plain', value: sql.slice(lastIndex) });
  }

  return tokens;
}

const TOKEN_COLORS = {
  keyword:  '#00f0ff',   // neon cyan — SELECT, FROM, WHERE…
  string:   '#fbbf24',   // amber — string literals
  number:   '#a78bfa',   // violet — numeric values
  comment:  '#6b7280',   // gray — comments
  operator: '#94a3b8',   // slate — =, (, ),  ,
  plain:    '#e2e8f0',   // light — identifiers, whitespace
};

const QueryCard = ({ queryResult, onTypingComplete }) => {
  const { query, sql, latency, tokensUsed, database, mode } = queryResult;
  const [copied, setCopied] = useState(false);
  const [typingState, setTypingState] = useState({ source: sql, text: '' });

  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex >= sql.length) {
        clearInterval(interval);
        if (onTypingComplete) {
          onTypingComplete();
        }
        return;
      }
      const char = sql.charAt(currentIndex);
      setTypingState((prev) => ({
        source: sql,
        text: prev.source === sql ? prev.text + char : char,
      }));
      currentIndex++;
    }, 8);
    return () => clearInterval(interval);
  }, [sql, onTypingComplete]);

  const typedSql = typingState.source === sql ? typingState.text : '';
  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isTyping = typedSql.length < sql.length;
  const tokens = highlightSQL(typedSql);

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-3xl mx-auto mt-8 glass-panel-cyan rounded-2xl p-6 relative border border-neon-cyan/30 shadow-[0_0_30px_rgba(0,240,255,0.08)] overflow-hidden"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-theme-text/10 pb-4 mb-5">
        <div className="flex items-center gap-2">
          <RiTerminalBoxLine className="text-xl text-neon-cyan" />
          <div>
            <h4 className="font-display font-bold text-sm text-theme-text tracking-wide uppercase">
              SQL AST Compilation
            </h4>
            <p className="text-[10px] font-mono text-theme-dim mt-0.5">
              TARGET DATABASE: <span className="text-neon-cyan">{database}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <div className="flex items-center gap-1 bg-theme-text/5 border border-theme-text/5 rounded-md px-2 py-1 text-[10px] font-mono text-theme-muted">
            <RiTimerLine className="text-neon-cyan" />
            <span>LATENCY: <strong className="text-theme-text">{latency}</strong></span>
          </div>
          <div className="flex items-center gap-1 bg-theme-text/5 border border-theme-text/5 rounded-md px-2 py-1 text-[10px] font-mono text-theme-muted">
            <RiCpuLine className="text-neon-purple" />
            <span>TOKENS: <strong className="text-theme-text">{tokensUsed}</strong></span>
          </div>
          <div className="flex items-center gap-1 bg-theme-text/5 border border-theme-text/5 rounded-md px-2 py-1 text-[10px] font-mono">
            {mode === 'simulated' ? (
              <span className="text-neon-purple shadow-[0_0_10px_rgba(171,0,255,0.3)] font-bold">SIMULATION</span>
            ) : (
              <span className="text-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)] font-bold">LIVE CORE</span>
            )}
          </div>
        </div>
      </div>

      {/* Natural language query block */}
      <div className="mb-5 bg-theme-code/15 border border-theme-text/5 rounded-lg p-3">
        <span className="font-mono text-[9px] text-theme-dim block mb-1 uppercase tracking-wider">
          Source Language Request:
        </span>
        <p className="text-sm font-medium text-theme-text italic">
          "{query}"
        </p>
      </div>

      {/* Generated SQL editor panel */}
      <div className="relative rounded-xl overflow-hidden bg-theme-code border border-theme-code-border">
        {/* Editor Title Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-theme-text/5 border-b border-theme-text/5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            <span className="text-[10px] font-mono text-theme-dim ml-2">sql_output.sql</span>
          </div>

          {/* Colour legend */}
          <div className="hidden sm:flex items-center gap-2 mr-3">
            {[['keyword', 'KW'], ['string', 'STR'], ['number', 'NUM']].map(([type, label]) => (
              <span key={type} className="text-[9px] font-mono" style={{ color: TOKEN_COLORS[type] }}>
                {label}
              </span>
            ))}
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-theme-text/5 hover:bg-neon-cyan/20 border border-theme-text/10 hover:border-neon-cyan/50 text-[10px] font-mono text-theme-muted hover:text-theme-text transition-all duration-200 cursor-pointer"
          >
            {copied ? (
              <>
                <RiCheckLine className="text-xs text-neon-cyan" />
                <span className="text-neon-cyan">COPIED</span>
              </>
            ) : (
              <>
                <RiFileCopyLine className="text-xs" />
                <span>COPY SQL</span>
              </>
            )}
          </button>
        </div>

        {/* Syntax-highlighted SQL */}
        <pre className="p-5 overflow-x-auto text-left text-sm font-mono leading-relaxed max-h-56 select-all">
          <code>
            {tokens.map((token, i) => (
              <span key={i} style={{ color: TOKEN_COLORS[token.type] }}>
                {token.value}
              </span>
            ))}
            {isTyping && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
                className="inline-block w-1.5 h-4 bg-neon-cyan ml-0.5 align-middle"
              />
            )}
          </code>
        </pre>
      </div>
    </motion.div>
  );
};

export default QueryCard;
