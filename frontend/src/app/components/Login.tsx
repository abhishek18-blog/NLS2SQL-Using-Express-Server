import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Database, Mail, Lock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Call our real backend login endpoint
      const res = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Login failed');
        return;
      }

      // Save the JWT token and role from the backend response
      localStorage.setItem('auth-token', data.token);
      localStorage.setItem('user-role', data.role === 'admin' ? 'Admin' : 'User');

      toast.success('Login successful!');
      navigate('/');

    } catch (err) {
      toast.error('Could not connect to server');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 flex items-center justify-center p-4 selection:bg-slate-300 dark:bg-indigo-500/30">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="h-16 w-16 bg-gradient-to-br from-slate-900 dark:from-indigo-500 to-black dark:to-indigo-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-slate-900/20 dark:shadow-indigo-500/20">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome Back</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Sign in to sync your text-to-SQL history</p>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 backdrop-blur-xl border border-slate-200 dark:border-zinc-800/80 rounded-3xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-indigo-500/50 focus:border-slate-900 dark:border-indigo-500 transition-all placeholder:text-zinc-600"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Password</label>
                <a href="#" className="text-xs text-slate-900 dark:text-indigo-400 hover:text-indigo-300 transition-colors">Forgot password?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-indigo-500/50 focus:border-slate-900 dark:border-indigo-500 transition-all placeholder:text-zinc-600"
                  required
                />
              </div>
            </div>

            <div className="flex mt-6">
              <button
                type="submit"
                className="w-full bg-slate-900 dark:bg-indigo-500 hover:bg-slate-800 dark:hover:bg-indigo-600 text-white rounded-xl py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/20 dark:shadow-indigo-500/20"
              >
                Sign In
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-8 text-center text-sm text-zinc-500">
            Don't have an account?{' '}
            <button onClick={() => navigate('/signup')} className="text-slate-900 dark:text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Create an account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
