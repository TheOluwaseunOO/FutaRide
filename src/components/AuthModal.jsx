import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('student');
  const [plateNumber, setPlateNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isRegistering) {
        await signUp({
          email,
          password,
          fullName,
          phoneNumber,
          role,
          vehiclePlateNumber: role === 'driver' ? plateNumber : null,
        });
      } else {
        await signIn({ email, password });
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-left">
      <h2 className="text-2xl font-bold text-white mb-2">
        {isRegistering ? 'Create FutaRide Account' : 'Sign In to FutaRide'}
      </h2>
      <p className="text-slate-400 text-sm mb-6">
        {isRegistering ? 'Choose your role and register' : 'Enter your credentials to continue'}
      </p>

      {errorMsg && (
        <div className="p-3 mb-4 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isRegistering && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
              <input
                required
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="e.g. Oluwaseun Olowoyo"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
              <input
                required
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="08012345678"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="student">Student (Rider)</option>
                <option value="driver">Keke Driver</option>
              </select>
            </div>

            {role === 'driver' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Plate Number</label>
                <input
                  required
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. AKR-123-XA"
                />
              </div>
            )}
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            placeholder="student@futa.edu.ng"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Processing...' : isRegistering ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-slate-400">
        {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          onClick={() => {
            setIsRegistering(!isRegistering);
            setErrorMsg('');
          }}
          className="text-emerald-400 hover:underline font-medium"
        >
          {isRegistering ? 'Sign In' : 'Register now'}
        </button>
      </div>
    </div>
  );
}
