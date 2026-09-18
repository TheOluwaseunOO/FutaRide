import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export default function App() {
  const [status, setStatus] = useState('Testing connection...');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function checkConnection() {
      try {
        // Ping the database by checking auth session
        const { error } = await supabase.auth.getSession();
        if (error) throw error;
        setStatus('Connected to Supabase successfully!');
        setIsSuccess(true);
      } catch (err) {
        setStatus(`Connection failed: ${err.message}`);
        setIsSuccess(false);
      }
    }
    checkConnection();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-extrabold text-emerald-400 mb-2">
          FutaRide MVP
        </h1>
        <p className="text-slate-400 text-sm mb-4">
          Campus Keke Dispatch Platform
        </p>
        <span
          className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${
            isSuccess
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}
        >
          {status}
        </span>
      </div>
    </main>
  );
}