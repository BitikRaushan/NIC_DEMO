import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  RiTeamLine, RiDatabase2Line, RiClipboardLine, RiAlertLine,
  RiBarChartBoxLine, RiHistoryLine, RiAddLine, RiDeleteBinLine,
  RiRefreshLine, RiCheckLine, RiCloseLine, RiKeyLine, RiPlugLine,
} from 'react-icons/ri';
import { useApp } from '../AppContext';
import {
  listMembers, inviteMember, updateMember, removeMember,
  listDatabases, testDatabase, createDatabase, deleteDatabase, refreshSchema,
  listAccessRequests, approveRequest, rejectRequest,
  listApprovals, approveQuery, rejectQuery,
  listAudit, getAnalytics, listDbPermissions, grantDbPermission, revokeDbPermission, searchUsers,
} from '../services/api';

const TABS = [
  { id: 'overview', label: 'Overview', icon: RiBarChartBoxLine },
  { id: 'members', label: 'Members', icon: RiTeamLine },
  { id: 'databases', label: 'Databases', icon: RiDatabase2Line },
  { id: 'requests', label: 'Access Requests', icon: RiClipboardLine },
  { id: 'approvals', label: 'Query Approvals', icon: RiAlertLine },
  { id: 'audit', label: 'Audit Log', icon: RiHistoryLine },
];

const Section = ({ title, children, action }) => (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-display font-bold text-sm uppercase tracking-widest text-theme-text">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

const Pill = ({ tone='cyan', children, testid }) => {
  const toneMap = {
    cyan: 'bg-neon-cyan/10 border-neon-cyan/40 text-neon-cyan',
    purple: 'bg-neon-purple/10 border-neon-purple/40 text-neon-purple',
    amber: 'bg-amber-400/10 border-amber-400/40 text-amber-400',
    red: 'bg-red-500/10 border-red-500/40 text-red-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400',
    gray: 'bg-theme-text/5 border-theme-text/10 text-theme-muted',
  };
  return (
    <span data-testid={testid} className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest border ${toneMap[tone]}`}>
      {children}
    </span>
  );
};

const STATUS_TONE = { pending: 'amber', approved: 'emerald', rejected: 'red', blocked: 'red', revoked: 'gray' };

/* ─────────────────────── Overview Tab ───────────────────────────── */
const Overview = ({ wsId }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!wsId) return;
    getAnalytics(wsId).then(r => r.success && setData(r));
  }, [wsId]);
  if (!data) return <div className="text-theme-muted font-mono text-xs" data-testid="overview-loading">Loading…</div>;
  const o = data.overview || {};
  const stats = [
    { label: 'Users', value: o.total_users, tone: 'cyan' },
    { label: 'Databases', value: o.total_databases, tone: 'purple' },
    { label: 'Pending Requests', value: o.pending_requests, tone: 'amber' },
    { label: 'Total Queries', value: o.total_queries, tone: 'cyan' },
    { label: 'Queries (24h)', value: o.queries_last_24h, tone: 'purple' },
    { label: 'Active Users (7d)', value: o.active_users_7d, tone: 'emerald' },
    { label: 'Success Rate', value: `${o.success_rate ?? 0}%`, tone: 'emerald' },
    { label: 'Failure Rate', value: `${o.failure_rate ?? 0}%`, tone: 'red' },
  ];

  const maxQ = Math.max(1, ...(data.queries_per_day || []).map(d => d.total));
  return (
    <div data-testid="overview-content">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="glass-panel rounded-xl p-4 border border-theme-text/10"
               data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <p className="font-mono text-[9px] uppercase tracking-widest text-theme-dim">{s.label}</p>
            <p className="font-display font-extrabold text-3xl mt-1 text-theme-text">{s.value ?? 0}</p>
          </div>
        ))}
      </div>

      <Section title="Queries per day (last 14d)">
        <div className="glass-panel rounded-xl p-5 border border-theme-text/10">
          <div className="flex items-end gap-1 h-32">
            {(data.queries_per_day || []).map((d) => {
              const h = Math.max(2, Math.round((d.total / maxQ) * 100));
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full bg-gradient-to-t from-neon-purple to-neon-cyan rounded-t" style={{ height: `${h}%` }}
                       title={`${d.day}: ${d.total} queries`} />
                  <span className="font-mono text-[8px] text-theme-dim">{d.day.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section title="Top Databases">
          <ul className="glass-panel rounded-xl border border-theme-text/10 divide-y divide-theme-text/5">
            {(data.top_databases || []).map(d => (
              <li key={d.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-theme-text">{d.name}</span>
                <Pill tone="cyan">{d.query_count} queries</Pill>
              </li>
            ))}
            {(data.top_databases || []).length === 0 && (
              <li className="px-4 py-6 text-center text-theme-muted text-xs font-mono">No data yet</li>
            )}
          </ul>
        </Section>
        <Section title="Most Active Users">
          <ul className="glass-panel rounded-xl border border-theme-text/10 divide-y divide-theme-text/5">
            {(data.top_users || []).map(u => (
              <li key={u.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <span>
                  <div className="text-theme-text">{u.name}</div>
                  <div className="text-theme-dim font-mono text-[10px]">{u.email}</div>
                </span>
                <Pill tone="purple">{u.query_count} queries</Pill>
              </li>
            ))}
            {(data.top_users || []).length === 0 && (
              <li className="px-4 py-6 text-center text-theme-muted text-xs font-mono">No data yet</li>
            )}
          </ul>
        </Section>
      </div>
    </div>
  );
};

/* ─────────────────────── Members Tab ────────────────────────────── */
const Members = ({ wsId }) => {
  const [items, setItems] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const reload = async () => {
    if (!wsId) return;
    const r = await listMembers(wsId);
    if (r.success) setItems(r.members || []);
  };
  useEffect(() => { reload(); }, [wsId]);

  const invite = async () => {
    setBusy(true); setErr('');
    const r = await inviteMember(wsId, email.trim().toLowerCase(), role);
    setBusy(false);
    if (!r.success) { setErr(r.error); return; }
    setEmail('');
    reload();
  };

  return (
    <div data-testid="members-tab">
      <div className="glass-panel rounded-xl border border-theme-text/10 p-4 mb-6">
        <h4 className="font-display font-bold text-sm text-theme-text mb-3">Invite a member</h4>
        <div className="flex flex-col sm:flex-row gap-3">
          <input value={email} onChange={e => setEmail(e.target.value)}
            data-testid="invite-email" placeholder="user@email.com"
            className="flex-1 bg-theme-input border border-theme-input-border rounded-lg px-3 py-2 text-sm" />
          <select value={role} onChange={e => setRole(e.target.value)}
            data-testid="invite-role"
            className="bg-theme-input border border-theme-input-border rounded-lg px-3 py-2 text-sm">
            <option value="viewer">Viewer</option>
            <option value="analyst">Analyst</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={invite} disabled={busy || !email}
            data-testid="invite-submit"
            className="px-4 py-2 rounded-lg bg-neon-cyan text-black font-bold text-xs disabled:opacity-50">
            Invite
          </button>
        </div>
        {err && <p className="text-red-400 text-xs mt-2" data-testid="invite-error">{err}</p>}
        <p className="text-[10px] text-theme-dim font-mono mt-2">
          Member must have already registered an account.
        </p>
      </div>

      <Section title={`Members (${items.length})`}>
        <div className="glass-panel rounded-xl border border-theme-text/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-theme-text/5 text-[10px] font-mono uppercase text-theme-dim">
              <tr>
                <th className="text-left px-4 py-2">User</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-text/5">
              {items.map(m => (
                <tr key={m.id} data-testid={`member-row-${m.user_id}`}>
                  <td className="px-4 py-2 text-theme-text">{m.name}</td>
                  <td className="px-4 py-2 text-theme-muted font-mono text-xs">{m.email}</td>
                  <td className="px-4 py-2">
                    <select value={m.role}
                      data-testid={`member-role-${m.user_id}`}
                      onChange={async e => { await updateMember(wsId, m.user_id, e.target.value); reload(); }}
                      className="bg-theme-input border border-theme-input-border rounded px-2 py-1 text-xs">
                      {['viewer','analyst','editor','admin'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={async () => { await removeMember(wsId, m.user_id); reload(); }}
                      data-testid={`member-remove-${m.user_id}`}
                      className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 ml-auto">
                      <RiDeleteBinLine /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
};

/* ─────────────────────── Databases Tab ───────────────────────── */
const NewDbForm = ({ wsId, onCreated }) => {
  const [form, setForm] = useState({
    name: '', db_type: 'postgresql', host: 'localhost', port: 5432,
    database_name: '', db_username: '', db_password: '', sslmode: 'disable', description: '',
  });
  const [testResult, setTestResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const doTest = async () => {
    setBusy(true); setTestResult(null); setErr('');
    const r = await testDatabase(wsId, { ...form, port: parseInt(form.port, 10) });
    setBusy(false);
    setTestResult(r.success ? { ok: r.connected, info: r.info } : { ok: false, info: r.error });
  };

  const doCreate = async () => {
    setBusy(true); setErr('');
    const r = await createDatabase(wsId, { ...form, port: parseInt(form.port, 10) });
    setBusy(false);
    if (r.success) { setForm({ ...form, name:'', database_name:'', db_username:'', db_password:'' }); setTestResult(null); onCreated?.(); }
    else setErr(r.error);
  };

  const F = (label, key, type='text', extra={}) => (
    <label className="block">
      <span className="block font-mono text-[10px] text-theme-muted uppercase mb-1">{label}</span>
      <input type={type} value={form[key] ?? ''} onChange={e => update(key, e.target.value)}
        data-testid={`db-form-${key}`}
        className="w-full bg-theme-input border border-theme-input-border rounded-lg px-3 py-2 text-sm" {...extra} />
    </label>
  );

  return (
    <div className="glass-panel rounded-xl border border-theme-text/10 p-5" data-testid="new-db-form">
      <h4 className="font-display font-bold text-sm text-theme-text mb-4 flex items-center gap-2">
        <RiAddLine /> Register a database
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {F('Name', 'name')}
        <label className="block">
          <span className="block font-mono text-[10px] text-theme-muted uppercase mb-1">DB Type</span>
          <select value={form.db_type} onChange={e => update('db_type', e.target.value)}
            data-testid="db-form-db_type"
            className="w-full bg-theme-input border border-theme-input-border rounded-lg px-3 py-2 text-sm">
            <option value="postgresql">PostgreSQL</option>
            <option value="mysql">MySQL (preview)</option>
          </select>
        </label>
        {F('Host', 'host')}
        {F('Port', 'port', 'number')}
        {F('Database name', 'database_name')}
        {F('Username', 'db_username')}
        {F('Password', 'db_password', 'password')}
        <label className="block">
          <span className="block font-mono text-[10px] text-theme-muted uppercase mb-1">SSL mode</span>
          <select value={form.sslmode} onChange={e => update('sslmode', e.target.value)}
            data-testid="db-form-sslmode"
            className="w-full bg-theme-input border border-theme-input-border rounded-lg px-3 py-2 text-sm">
            {['disable','allow','prefer','require','verify-ca','verify-full'].map(m => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="block font-mono text-[10px] text-theme-muted uppercase mb-1">Description</span>
          <textarea rows={2} value={form.description} onChange={e => update('description', e.target.value)}
            data-testid="db-form-description"
            className="w-full bg-theme-input border border-theme-input-border rounded-lg px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <button onClick={doTest} disabled={busy}
          data-testid="db-form-test"
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-theme-text/5 border border-theme-text/10 hover:border-neon-cyan/40 text-xs font-mono">
          <RiPlugLine /> Test connection
        </button>
        <button onClick={doCreate} disabled={busy || !form.name || !form.host}
          data-testid="db-form-create"
          className="flex items-center gap-1 px-5 py-2 rounded-lg bg-gradient-to-r from-neon-cyan to-neon-blue text-black font-bold text-xs disabled:opacity-50">
          <RiAddLine /> Save database
        </button>
        {testResult && (
          <span className={`text-xs font-mono flex items-center gap-1 ${
            testResult.ok ? 'text-emerald-400' : 'text-red-400'
          }`} data-testid="db-form-test-result">
            {testResult.ok ? <RiCheckLine /> : <RiCloseLine />}
            {testResult.ok ? 'Connected' : `Failed: ${testResult.info || 'unknown'}`}
          </span>
        )}
        {err && <span className="text-xs text-red-400" data-testid="db-form-error">{err}</span>}
      </div>
    </div>
  );
};

const DbPermsModal = ({ wsId, db, onClose }) => {
  const [perms, setPerms] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [pickedUser, setPickedUser] = useState(null);
  const [role, setRole] = useState('viewer');

  const reload = () => listDbPermissions(wsId, db.id).then(r => r.success && setPerms(r.permissions));
  useEffect(() => { reload(); }, [db.id]);
  useEffect(() => {
    if (search.length < 1) { setUsers([]); return; }
    searchUsers(search).then(r => r.success && setUsers(r.users));
  }, [search]);

  const grant = async () => {
    if (!pickedUser) return;
    await grantDbPermission(wsId, db.id, pickedUser.id, role);
    setPickedUser(null); setSearch('');
    reload();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" data-testid="db-perms-modal">
      <div className="glass-panel-cyan rounded-2xl max-w-xl w-full p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-theme-muted" data-testid="close-perms-modal">
          <RiCloseLine className="text-2xl" />
        </button>
        <h3 className="font-display font-bold text-lg text-theme-text mb-1">Manage Access</h3>
        <p className="font-mono text-[10px] text-theme-dim uppercase tracking-widest mb-4">
          {db.name}
        </p>

        <div className="mb-5 relative">
          <span className="block font-mono text-[10px] text-theme-muted uppercase mb-1">Grant access to</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPickedUser(null); }}
            placeholder="search users by name or email"
            data-testid="perm-user-search"
            className="w-full bg-theme-input border border-theme-input-border rounded-lg px-3 py-2 text-sm" />
          {users.length > 0 && !pickedUser && (
            <ul className="absolute z-50 bg-space-deep border border-theme-text/10 rounded-lg mt-1 w-full max-h-44 overflow-y-auto">
              {users.map(u => (
                <li key={u.id}>
                  <button onClick={() => { setPickedUser(u); setSearch(`${u.name} (${u.email})`); setUsers([]); }}
                    data-testid={`perm-user-${u.id}`}
                    className="block w-full text-left px-3 py-2 hover:bg-neon-cyan/10 text-sm">
                    <span className="text-theme-text">{u.name}</span>
                    <span className="text-theme-dim font-mono text-xs ml-2">{u.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 mt-3">
            <select value={role} onChange={e => setRole(e.target.value)}
              data-testid="perm-role-select"
              className="flex-1 bg-theme-input border border-theme-input-border rounded-lg px-3 py-2 text-sm">
              {['viewer','analyst','editor','admin'].map(r => <option key={r}>{r}</option>)}
            </select>
            <button onClick={grant} disabled={!pickedUser}
              data-testid="perm-grant-btn"
              className="px-4 py-2 rounded-lg bg-neon-cyan text-black font-bold text-xs disabled:opacity-50">
              Grant
            </button>
          </div>
        </div>

        <h4 className="font-display font-bold text-sm text-theme-text mb-2">Current grants</h4>
        <ul className="divide-y divide-theme-text/5 bg-theme-text/5 rounded-lg" data-testid="perm-list">
          {perms.map(p => (
            <li key={p.id} className="px-3 py-2 flex items-center justify-between text-sm">
              <span>
                <span className="text-theme-text">{p.name}</span>
                <span className="text-theme-dim font-mono text-xs ml-2">{p.email}</span>
              </span>
              <span className="flex items-center gap-2">
                <Pill tone="cyan">{p.role}</Pill>
                <button onClick={async () => { await revokeDbPermission(wsId, db.id, p.user_id); reload(); }}
                  data-testid={`perm-revoke-${p.user_id}`}
                  className="text-red-400 text-xs">revoke</button>
              </span>
            </li>
          ))}
          {perms.length === 0 && <li className="text-center text-theme-muted text-xs font-mono py-4">No direct grants.</li>}
        </ul>
      </div>
    </div>
  );
};

const Databases = ({ wsId }) => {
  const { refreshDatabases } = useApp();
  const [items, setItems] = useState([]);
  const [permsModalDb, setPermsModalDb] = useState(null);
  const reload = async () => {
    const r = await listDatabases(wsId);
    if (r.success) { setItems(r.databases || []); }
    refreshDatabases();
  };
  useEffect(() => { reload(); }, [wsId]);

  return (
    <div data-testid="databases-tab" className="space-y-6">
      <NewDbForm wsId={wsId} onCreated={reload} />
      <Section title={`Registered databases (${items.length})`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(d => (
            <div key={d.id} className="glass-panel rounded-xl border border-theme-text/10 p-4 flex flex-col gap-2"
                 data-testid={`admin-db-${d.id}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-bold text-sm text-theme-text">{d.name}</p>
                  <p className="font-mono text-[10px] text-theme-dim uppercase tracking-widest">
                    {d.db_type} · {d.host}:{d.port}/{d.database_name}
                  </p>
                </div>
                <Pill tone="cyan">{d.schema_cache?.length || 0} tables</Pill>
              </div>
              <p className="text-xs text-theme-muted line-clamp-2">{d.description}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={async () => { await refreshSchema(wsId, d.id); reload(); }}
                  data-testid={`admin-db-refresh-${d.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-theme-text/5 border border-theme-text/10 hover:border-neon-cyan/40 text-[10px] font-mono">
                  <RiRefreshLine /> Refresh Schema
                </button>
                <button onClick={() => setPermsModalDb(d)}
                  data-testid={`admin-db-perms-${d.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-theme-text/5 border border-theme-text/10 hover:border-neon-purple/40 text-[10px] font-mono">
                  <RiKeyLine /> Permissions
                </button>
                <button onClick={async () => { if (confirm(`Delete ${d.name}?`)) { await deleteDatabase(wsId, d.id); reload(); } }}
                  data-testid={`admin-db-delete-${d.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 hover:border-red-500/60 text-[10px] font-mono text-red-400">
                  <RiDeleteBinLine /> Delete
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="glass-panel rounded-xl border border-dashed border-theme-text/10 p-6 text-center text-theme-muted text-xs font-mono col-span-full">
              No databases yet.
            </div>
          )}
        </div>
      </Section>
      {permsModalDb && <DbPermsModal wsId={wsId} db={permsModalDb} onClose={() => setPermsModalDb(null)} />}
    </div>
  );
};

/* ─────────────────────── Requests Tab ────────────────────────── */
const Requests = ({ wsId }) => {
  const [items, setItems] = useState([]);
  const reload = () => listAccessRequests(wsId).then(r => r.success && setItems(r.requests || []));
  useEffect(() => { reload(); }, [wsId]);

  return (
    <div data-testid="requests-tab">
      <Section title={`Access requests (${items.length})`}>
        <div className="glass-panel rounded-xl border border-theme-text/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-theme-text/5 text-[10px] font-mono uppercase text-theme-dim">
              <tr>
                <th className="text-left px-4 py-2">User</th>
                <th className="text-left px-4 py-2">Database</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-left px-4 py-2">Reason</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-text/5">
              {items.map(r => (
                <tr key={r.id} data-testid={`request-row-${r.id}`}>
                  <td className="px-4 py-2">
                    <div className="text-theme-text">{r.user_name}</div>
                    <div className="text-theme-dim font-mono text-xs">{r.user_email}</div>
                  </td>
                  <td className="px-4 py-2 text-theme-muted">{r.db_name}</td>
                  <td className="px-4 py-2"><Pill tone="cyan">{r.requested_role}</Pill></td>
                  <td className="px-4 py-2 text-xs text-theme-muted max-w-xs">{r.reason || '—'}</td>
                  <td className="px-4 py-2">
                    <Pill tone={STATUS_TONE[r.status] || 'gray'}>{r.status}</Pill>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <button onClick={async () => { await approveRequest(wsId, r.id); reload(); }}
                          data-testid={`req-approve-${r.id}`}
                          className="px-3 py-1 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs">
                          Approve
                        </button>
                        <button onClick={async () => { await rejectRequest(wsId, r.id); reload(); }}
                          data-testid={`req-reject-${r.id}`}
                          className="px-3 py-1 rounded bg-red-500/15 border border-red-500/40 text-red-400 text-xs">
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="text-center text-theme-muted text-xs font-mono py-6">No requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
};

/* ─────────────────────── Approvals Tab ───────────────────────── */
const Approvals = ({ wsId }) => {
  const [items, setItems] = useState([]);
  const reload = () => listApprovals(wsId).then(r => r.success && setItems(r.approvals || []));
  useEffect(() => { reload(); }, [wsId]);

  return (
    <div data-testid="approvals-tab">
      <Section title={`High-risk query approvals (${items.length})`}>
        <ul className="space-y-3">
          {items.map(a => (
            <li key={a.id} className="glass-panel rounded-xl border border-theme-text/10 p-4" data-testid={`approval-${a.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <Pill tone="amber">{a.query_type}</Pill>
                  <Pill tone={STATUS_TONE[a.status] || 'gray'}>{a.status}</Pill>
                  <span className="text-xs text-theme-muted">{a.user_name} · {a.db_name}</span>
                </div>
                <span className="text-[10px] font-mono text-theme-dim">{new Date(a.created_at).toLocaleString()}</span>
              </div>
              <p className="italic text-theme-muted text-sm mb-2">"{a.natural_prompt}"</p>
              <pre className="text-xs font-mono text-neon-cyan/90 bg-theme-code rounded p-3 overflow-x-auto">{a.generated_sql}</pre>
              {a.risk_reasons?.length > 0 && (
                <div className="mt-2 text-[10px] font-mono text-amber-400">
                  {a.risk_reasons.join(' · ')}
                </div>
              )}
              {a.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={async () => { await approveQuery(wsId, a.id); reload(); }}
                    data-testid={`approval-approve-${a.id}`}
                    className="px-4 py-1.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs">Approve & Execute</button>
                  <button onClick={async () => { await rejectQuery(wsId, a.id, false); reload(); }}
                    data-testid={`approval-reject-${a.id}`}
                    className="px-4 py-1.5 rounded bg-red-500/15 border border-red-500/40 text-red-400 text-xs">Reject</button>
                  <button onClick={async () => { await rejectQuery(wsId, a.id, true); reload(); }}
                    data-testid={`approval-block-${a.id}`}
                    className="px-4 py-1.5 rounded bg-red-500/20 border border-red-500/60 text-red-300 text-xs">Block Permanently</button>
                </div>
              )}
            </li>
          ))}
          {items.length === 0 && <li className="text-center text-theme-muted text-xs font-mono py-6">No high-risk queries flagged.</li>}
        </ul>
      </Section>
    </div>
  );
};

/* ─────────────────────── Audit Tab ───────────────────────────── */
const AuditTab = ({ wsId }) => {
  const [items, setItems] = useState([]);
  const [qType, setQType] = useState('');
  useEffect(() => {
    listAudit(wsId, qType ? { query_type: qType } : {}).then(r => r.success && setItems(r.logs || []));
  }, [wsId, qType]);

  const exportCsv = () => {
    if (!items.length) return;
    const rows = [
      ['timestamp','user','db','action','query_type','success','execution_ms','row_count','sql'],
      ...items.map(i => [
        i.created_at, i.user_name||'', i.db_name||'', i.action, i.query_type||'',
        i.success, i.execution_ms||'', i.row_count||'',
        (i.generated_sql||'').replace(/[\n\r]+/g, ' ').replace(/"/g,'""'),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `qb_audit_${Date.now()}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
  };

  return (
    <div data-testid="audit-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase text-theme-dim">Filter by query type:</span>
          <select value={qType} onChange={e => setQType(e.target.value)}
            data-testid="audit-filter-type"
            className="bg-theme-input border border-theme-input-border rounded px-2 py-1 text-xs">
            <option value="">All</option>
            {['SELECT','INSERT','UPDATE','DELETE','DDL'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={exportCsv}
          data-testid="audit-export-btn"
          className="px-3 py-1.5 rounded bg-neon-purple/15 border border-neon-purple/40 text-neon-purple text-xs">
          Export CSV
        </button>
      </div>
      <div className="glass-panel rounded-xl border border-theme-text/10 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-theme-text/5 text-[9px] font-mono uppercase text-theme-dim">
            <tr>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">DB</th>
              <th className="text-left px-3 py-2">Action</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">SQL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-text/5">
            {items.map(l => (
              <tr key={l.id} data-testid={`audit-row-${l.id}`}>
                <td className="px-3 py-1.5 font-mono text-[10px] text-theme-dim whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                <td className="px-3 py-1.5">{l.user_name || '—'}</td>
                <td className="px-3 py-1.5 text-theme-muted">{l.db_name || '—'}</td>
                <td className="px-3 py-1.5"><Pill tone="cyan">{l.action}</Pill></td>
                <td className="px-3 py-1.5">{l.query_type ? <Pill tone="purple">{l.query_type}</Pill> : '—'}</td>
                <td className="px-3 py-1.5">{l.success === false ? <Pill tone="red">fail</Pill> : l.success === true ? <Pill tone="emerald">ok</Pill> : '—'}</td>
                <td className="px-3 py-1.5 font-mono text-[11px] text-neon-cyan/90 max-w-md truncate">{l.generated_sql || l.error_message || ''}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="text-center text-theme-muted text-xs font-mono py-6">No events.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─────────────────────── AdminPanel ─────────────────────────── */
const AdminPanel = () => {
  const { activeWsId, activeWorkspace, isWorkspaceAdmin, isPlatformAdmin } = useApp();
  const [tab, setTab] = useState('overview');

  if (!activeWsId) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 text-center text-theme-muted">
        Select a workspace first.
      </div>
    );
  }
  if (!isWorkspaceAdmin && !isPlatformAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 text-center">
        <RiAlertLine className="text-4xl text-amber-400 mx-auto mb-3" />
        <p className="text-theme-muted">You need workspace-admin permission to access this panel.</p>
      </div>
    );
  }

  const map = {
    overview: <Overview wsId={activeWsId} />,
    members: <Members wsId={activeWsId} />,
    databases: <Databases wsId={activeWsId} />,
    requests: <Requests wsId={activeWsId} />,
    approvals: <Approvals wsId={activeWsId} />,
    audit: <AuditTab wsId={activeWsId} />,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16" data-testid="admin-panel">
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-neon-purple mb-1">
            Admin Console · {activeWorkspace?.name}
          </p>
          <h1 className="font-display font-extrabold text-3xl md:text-4xl text-theme-text">
            Governance & Access Management
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8 border-b border-theme-text/10 pb-3">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            data-testid={`admin-tab-${id}`}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-widest transition-all ${
              tab === id ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/40' : 'text-theme-muted hover:text-theme-text border border-transparent'
            }`}>
            <Icon /> {label}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        {map[tab]}
      </motion.div>
    </div>
  );
};

export default AdminPanel;
