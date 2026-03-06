import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { setStoredAuth } from '../utils/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(email, password);
      setStoredAuth(data.token, data.user);
      if (data.user.role === 'admin' || data.user.role === 'manager') {
        navigate('/admin');
      } else {
        navigate('/staff');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50">
      <div className="w-full max-w-6xl min-h-[560px] flex flex-col lg:flex-row rounded-2xl overflow-hidden border border-slate-200/80 shadow-xl bg-white">
        {/* Left – Logo & brand (white theme) */}
        <div className="w-full lg:w-[50%] flex flex-col items-center justify-center p-8 sm:p-10 lg:p-14 bg-white border-b lg:border-b-0 lg:border-r border-slate-100">
          <div className="flex flex-col items-center text-center max-w-sm">
            {!logoError ? (
              <img
                src="/Vision JPG Logo.JPG"
                alt="Vision Travel Hub"
                className="w-full max-w-[280px] sm:max-w-[320px] h-auto object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-full max-w-[280px]">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-500 via-primary-500 to-teal-500 bg-clip-text text-transparent">
                  VISION TRAVEL HUB
                </h2>
                <div className="mt-3 w-16 h-16 mx-auto rounded-full bg-brand-orange/10 border-2 border-orange-400/30" />
              </div>
            )}
            <span className="mt-6 inline-block px-5 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold tracking-widest uppercase">
              Since 2017
            </span>
            <p className="mt-4 text-slate-500 text-sm leading-relaxed">
              Your journey to seamless travel management starts here.
            </p>
          </div>
        </div>

        {/* Right – Form (white, brand colours on controls) */}
        <div className="w-full lg:w-[50%] flex flex-col justify-center p-8 sm:p-10 lg:p-14 bg-white">
          <h1 className="text-slate-900 font-bold text-2xl sm:text-3xl tracking-tight mb-1">
            Login
          </h1>
          <p className="text-slate-500 text-sm mb-8">Use your credentials to access the dashboard.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-semibold text-sm text-white tracking-wide shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 via-primary-500 to-primary-600 hover:from-blue-700 hover:via-primary-600 hover:to-primary-700"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="mt-8 text-xs text-slate-400">
            Secure access for authorised staff only.
          </p>
        </div>
      </div>
    </div>
  );
}
