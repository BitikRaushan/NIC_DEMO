import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchCurrentUser, getStoredAuth, logoutUser,
  listWorkspaces, listDatabases, getRoles,
  getActiveWorkspaceId, setActiveWorkspaceId,
} from './services/api';

const Ctx = createContext(null);

export const useApp = () => useContext(Ctx);

export const AppProvider = ({ children }) => {
  const stored = getStoredAuth();
  const [user, setUser] = useState(stored?.user || null);
  const [authChecking, setAuthChecking] = useState(Boolean(stored));
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWsId, _setActiveWsId] = useState(getActiveWorkspaceId());
  const [databases, setDatabases] = useState([]);
  const [activeDbId, setActiveDbId] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loadingWs, setLoadingWs] = useState(false);

  const setActiveWs = useCallback((id) => {
    setActiveWorkspaceId(id);
    _setActiveWsId(id);
    setActiveDbId(null);
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    setLoadingWs(true);
    const r = await listWorkspaces();
    setLoadingWs(false);
    if (r.success) {
      setWorkspaces(r.workspaces || []);
      if (!activeWsId && r.workspaces?.length) {
        setActiveWs(r.workspaces[0].id);
      }
      // If current activeWs is gone, reset
      if (activeWsId && !r.workspaces?.find(w => w.id === activeWsId)) {
        setActiveWs(r.workspaces?.[0]?.id || null);
      }
    }
    return r;
  }, [activeWsId, setActiveWs]);

  const refreshDatabases = useCallback(async (wsId) => {
    const id = wsId ?? activeWsId;
    if (!id) { setDatabases([]); return { success: true, databases: [] }; }
    const r = await listDatabases(id);
    if (r.success) {
      setDatabases(r.databases || []);
      if (!activeDbId && r.databases?.length) {
        const accessible = r.databases.find(d => d.my_role) || r.databases[0];
        setActiveDbId(accessible.id);
      }
    }
    return r;
  }, [activeWsId, activeDbId]);

  // initial bootstrap: who am I + workspaces + roles
  useEffect(() => {
    let mounted = true;
    const auth = getStoredAuth();
    (async () => {
      if (auth) {
        const r = await fetchCurrentUser();
        if (!mounted) return;
        setUser(r.success ? r.user : null);
        setAuthChecking(false);
      }
      const rolesR = await getRoles();
      if (rolesR.success && mounted) setRoles(rolesR.roles || []);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (user) refreshWorkspaces();
  }, [user, refreshWorkspaces]);

  useEffect(() => {
    if (activeWsId) refreshDatabases(activeWsId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWsId]);

  const activeWorkspace = useMemo(
    () => workspaces.find(w => w.id === activeWsId) || null,
    [workspaces, activeWsId],
  );
  const activeDb = useMemo(
    () => databases.find(d => d.id === activeDbId) || null,
    [databases, activeDbId],
  );

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setWorkspaces([]);
    setDatabases([]);
    setActiveWs(null);
  };

  const isPlatformAdmin = !!user?.is_platform_admin;
  const isWorkspaceAdmin =
    isPlatformAdmin ||
    (activeWorkspace && activeWorkspace.owner_id === user?.id) ||
    (activeWorkspace && activeDb?.my_role === 'admin');

  // workspace_role isn't returned in list; fetch on demand via getWorkspace if needed.

  const value = {
    user, setUser, authChecking,
    workspaces, refreshWorkspaces, loadingWs,
    activeWsId, activeWorkspace, setActiveWs,
    databases, refreshDatabases, activeDbId, setActiveDbId, activeDb,
    roles, isPlatformAdmin, isWorkspaceAdmin,
    handleLogout,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
