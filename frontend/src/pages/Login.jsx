import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Decorative gradient orb */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent/20 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md bg-surface/50 backdrop-blur-xl p-8 rounded-2xl border border-slate-700/50 shadow-2xl relative z-10"
      >
        <h2 className="text-3xl font-bold text-white mb-6 text-center tracking-tight">Welcome Back</h2>
        
        {error && (
            <div className="mb-4 p-3 bg-accent/20 border border-accent/50 text-accent rounded-lg text-sm text-center">
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit" 
            className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-3 rounded-lg shadow-lg shadow-primary/30 transition-all mt-4"
          >
            Sign In
          </motion.button>
        </form>

        <p className="mt-6 text-center text-slate-400 text-sm">
          Don't have an account? <Link to="/register" className="text-primary hover:text-blue-400 transition-colors">Register now</Link>
        </p>
      </motion.div>
    </div>
  );
}
