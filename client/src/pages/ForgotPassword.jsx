import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { data } = await forgotPassword(email);
      setMessage(data?.message || 'If this email exists, a reset link has been sent.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to process request right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-800">Forgot Password</h1>
        <p className="text-sm text-slate-500 mt-1">Enter your email to continue.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-primary-600 text-white text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Please wait...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-5 text-sm">
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
