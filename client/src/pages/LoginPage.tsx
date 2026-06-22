import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, NotAdminError } from '../contexts/AuthContext';

export function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notAdminUid, setNotAdminUid] = useState('');

  async function handleGoogleLogin() {
    setError('');
    setNotAdminUid('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/admin/orders', { replace: true });
    } catch (err) {
      if (err instanceof NotAdminError) {
        setNotAdminUid(err.uid);
      } else {
        const code = (err as { code?: string }).code;
        if (code !== 'auth/popup-closed-by-user') {
          setError('Sign-in failed. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-stone-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🍽</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-2">Admin Login</h1>
          <p className="text-stone-500 text-sm mt-1">Sign in with your Google account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 space-y-4">
          {/* Generic error */}
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {/* Not-admin error — show UID for setup */}
          {notAdminUid && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-2">
              <p className="text-sm font-semibold text-amber-800">Account not authorised as admin.</p>
              <p className="text-xs text-amber-700">
                Ask the site owner to run the following command with your UID, then sign in again:
              </p>
              <pre className="text-xs bg-amber-100 rounded p-2 break-all select-all text-amber-900">
{`POST /api/auth/set-admin
{ "uid": "${notAdminUid}", "secret": "<SETUP_SECRET>" }`}
              </pre>
              <p className="text-xs text-amber-600">Your UID: <span className="font-mono font-bold select-all">{notAdminUid}</span></p>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 transition disabled:opacity-60 font-medium text-stone-700 text-sm"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>
        </div>

        <p className="text-center text-xs text-stone-400 mt-4">
          Only authorised admin accounts can sign in here.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
