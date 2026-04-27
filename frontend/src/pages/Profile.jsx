import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { User, Mail, Star, Heart, LogOut, Shield, Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Profile() {
    const { user, logout, ratings } = useContext(AuthContext);

    if (!user) return null;

    const ratingCount = Object.keys(ratings || {}).length;
    const avgRating = ratingCount > 0
        ? (Object.values(ratings).reduce((a, b) => a + b, 0) / ratingCount).toFixed(1)
        : '—';
    const favoriteCount = user.favorites?.length || 0;

    const stats = [
        { icon: Star, label: 'Movies Rated', value: ratingCount, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
        { icon: Heart, label: 'In My List', value: favoriteCount, color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/20' },
        { icon: Star, label: 'Avg. Rating', value: avgRating, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
    ];

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto px-6 py-12 space-y-6"
        >
            {/* Profile Hero Card */}
            <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                {/* Top gradient accent */}
                <div className="h-24 bg-gradient-to-br from-primary/40 via-purple-900/30 to-slate-900" />
                <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

                <div className="px-8 pb-8 -mt-12 relative z-10">
                    {/* Avatar */}
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary/60 to-purple-700/60 border-4 border-slate-900 flex items-center justify-center shadow-xl mb-4">
                        <span className="text-3xl font-black text-white select-none">
                            {user.name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight mb-1">{user.name}</h1>
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-6">
                        <Mail className="w-4 h-4" />
                        <span>{user.email}</span>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-4">
                        {stats.map(({ icon: Icon, label, value, color, bg, border }) => (
                            <div key={label} className={`${bg} ${border} border rounded-xl p-4 flex flex-col items-center gap-1 text-center`}>
                                <Icon className={`w-5 h-5 ${color}`} />
                                <span className="text-2xl font-black text-white">{value}</span>
                                <span className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link to="/library" className="flex items-center gap-4 p-5 bg-slate-900/60 border border-slate-700/50 rounded-xl hover:border-primary/40 hover:bg-slate-800/60 transition-all group">
                    <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                        <p className="text-white font-semibold text-sm">My List</p>
                        <p className="text-slate-400 text-xs">{favoriteCount} Movies</p>
                    </div>
                </Link>

                <Link to="/recommendations" className="flex items-center gap-4 p-5 bg-slate-900/60 border border-slate-700/50 rounded-xl hover:border-primary/40 hover:bg-slate-800/60 transition-all group">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Star className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-white font-semibold text-sm">For You</p>
                        <p className="text-slate-400 text-xs">Your recommendations</p>
                    </div>
                </Link>
            </div>

            {/* Account Details */}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700/50">
                    <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" /> Account Details
                    </h3>
                </div>
                <div className="divide-y divide-slate-800/80">
                    {[
                        { label: 'Full Name', value: user.name },
                        { label: 'Email', value: user.email },
                        { label: 'Member Since', value: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'N/A' },
                        { label: 'User ID', value: user.appUserId ? `#${user.appUserId}` : 'Not assigned' },
                    ].map(row => (
                        <div key={row.label} className="flex items-center justify-between px-6 py-4">
                            <span className="text-slate-400 text-sm">{row.label}</span>
                            <span className="text-white text-sm font-medium">{row.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sign Out */}
            <button 
                onClick={logout}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-accent/10 border border-accent/20 text-accent font-semibold hover:bg-accent hover:text-white transition-all duration-300"
            >
                <LogOut className="w-5 h-5" />
                Sign Out
            </button>
        </motion.div>
    );
}
