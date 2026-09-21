import { AuthProvider, useAuth } from './context/AuthContext';
import AuthModal from './components/AuthModal';

function AppContent() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Initializing session...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
      {user ? (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full">
          <div className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
            Active Session
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Welcome, {profile?.full_name || user.email}!
          </h1>
          <p className="text-slate-400 text-sm mb-4 capitalize">
            Role: <span className="text-emerald-400 font-semibold">{profile?.role || 'User'}</span>
          </p>
          <p className="text-xs text-slate-500 mb-6 break-all">ID: {user.id}</p>
          <button
            onClick={signOut}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg text-sm transition-colors border border-slate-700"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <AuthModal />
      )}
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}