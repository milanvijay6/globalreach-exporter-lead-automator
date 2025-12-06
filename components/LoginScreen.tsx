
import React, { useState } from 'react';
import { User } from '../types';
import { AuthService } from '../services/authService';
import { saveUserSession } from '../services/securityService';
import { Shield, Mail, Lock, UserPlus } from 'lucide-react';
import SignupScreen from './SignupScreen';
import { OptimizedButton } from './OptimizedButton';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignup, setShowSignup] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await AuthService.login(email, password);

      if (result.success && result.user) {
        // Save session
        await saveUserSession(result.user);
        
        // Check if PIN is set (optional - user can proceed without PIN)
        // PIN will be required later for sensitive actions
        
        // Check if account is locked
        if (result.user.lockoutUntil && result.user.lockoutUntil > Date.now()) {
          const minutesLeft = Math.ceil((result.user.lockoutUntil - Date.now()) / 60000);
          setError(`Account is locked. Please try again in ${minutesLeft} minutes.`);
          setLoading(false);
          return;
        }

        // Redirect based on role
        onLogin(result.user);
      } else {
        setError(result.error || 'Invalid email or password');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  if (showSignup) {
    return (
      <SignupScreen
        onBackToLogin={() => setShowSignup(false)}
        onSignupSuccess={() => setShowSignup(false)}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col justify-center items-center bg-slate-100 px-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}>
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">GlobalReach Login</h1>
          <p className="text-slate-500 mt-2">Secure Access Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="your.email@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <OptimizedButton
            type="submit"
            loading={loading}
            variant="primary"
            className="w-full"
          >
            <Lock className="w-4 h-4" /> Sign In
          </OptimizedButton>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShowSignup(true)}
            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1 mx-auto"
          >
            <UserPlus className="w-4 h-4" /> New User Signup
          </button>
        </div>
        
        <div className="mt-4 text-center text-xs text-slate-400">
          Secure Authentication
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
