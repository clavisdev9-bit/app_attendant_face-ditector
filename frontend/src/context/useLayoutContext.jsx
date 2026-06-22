import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(undefined);

export const useLayoutContext = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useLayoutContext must be used within LayoutProvider');
  return ctx;
};

const STORAGE_KEY = '__HADIR_THEME__';

const saved = (() => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
})();

const INIT = {
  theme:    saved.theme    || 'light',
  sidebarOpen: saved.sidebarOpen !== false,
};

export const LayoutProvider = ({ children }) => {
  const [theme,       setTheme]       = useState(INIT.theme);
  const [sidebarOpen, setSidebarOpen] = useState(INIT.sidebarOpen);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  /* Apply dark class to <html> */
  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') html.classList.add('dark');
    else                  html.classList.remove('dark');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, sidebarOpen }));
  }, [theme, sidebarOpen]);

  const changeTheme   = useCallback((t) => setTheme(t), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const toggleMobile  = useCallback(() => setMobileSidebarOpen((v) => !v), []);

  return (
    <ThemeContext.Provider value={useMemo(() => ({
      theme,
      sidebarOpen,
      mobileSidebarOpen,
      changeTheme,
      toggleSidebar,
      toggleMobile,
      setMobileSidebarOpen,
    }), [theme, sidebarOpen, mobileSidebarOpen])}>
      {children}
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
    </ThemeContext.Provider>
  );
};
