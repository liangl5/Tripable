import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthStatus() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);
  const [message, setMessage] = useState('');

  const returnUrl = searchParams.get('return') || '/trips';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage('Error: Passwords do not match');
      return;
    }
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Check your email for the confirmation link!');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => navigate(returnUrl), 3000);
    }
    setLoading(false);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Signed in successfully!');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => navigate(returnUrl), 1000);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setMessage('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  if (session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Tripable</h1>
          <div className="space-y-4">
            <p className="text-slate-600">
              Logged in as: <span className="font-semibold">{session.user.email}</span>
            </p>
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Tripable</h1>
          <p className="text-slate-500 mb-8">Plan trips together, effortlessly</p>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-8 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => isSignUp ? null : switchMode()}
              className={`flex-1 py-2 px-4 rounded-md font-semibold transition ${
                isSignUp
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              Create Account
            </button>
            <button
              onClick={() => !isSignUp ? null : switchMode()}
              className={`flex-1 py-2 px-4 rounded-md font-semibold transition ${
                !isSignUp
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              Sign In
            </button>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                placeholder="your-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>

            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                    password && confirmPassword && password !== confirmPassword
                      ? 'border-red-500 bg-red-50'
                      : password && confirmPassword && password === confirmPassword
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-300'
                  }`}
                />
                {password && confirmPassword && password !== confirmPassword && (
                  <p className="text-red-600 text-xs mt-1 font-medium">Passwords do not match</p>
                )}
                {password && confirmPassword && password === confirmPassword && (
                  <p className="text-green-600 text-xs mt-1 font-medium">Passwords match ✓</p>
                )}
              </div>
            )}

            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.includes('Error') 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isSignUp && password && confirmPassword && password !== confirmPassword)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
