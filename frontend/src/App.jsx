import { AuthProvider, useAuth } from "./context/AuthContext";
import { LayoutProvider } from "./context/useLayoutContext";
import Login   from "./pages/Login";
import AppShell from "./components/AppShell";

function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner w-10 h-10 border-3" />
          <span className="text-sm text-slate-500">Memuat sistem…</span>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <LayoutProvider>
      <AppShell />
    </LayoutProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
