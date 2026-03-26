import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword, verifyResetToken } from '../services/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = useMemo(() => String(params.get('token') || ''), [params]);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Reset link is invalid.');
      setTokenValid(false);
      setValidating(false);
      return;
    }
    setValidating(true);
    verifyResetToken(token)
      .then(() => {
        setTokenValid(true);
        setError('');
      })
      .catch((err) => {
        setTokenValid(false);
        setError(err.response?.data?.message || 'Reset link is invalid or expired.');
      })
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await resetPassword(token, password);
      setMessage(data?.message || 'Password reset successful.');
      setPassword('');
      setConfirmPassword('');
      setTokenValid(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-800">Reset Password</h1>
        <p className="text-sm text-slate-500 mt-1">Create a new secure password.</p>

        {validating ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Validating reset link...
          </div>
        ) : (
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
            {tokenValid && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                    minLength={8}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-primary-600 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? 'Resetting...' : 'Reset Password'}
                </button>
              </>
            )}
          </form>
        )}

        <div className="mt-5 text-sm">
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
