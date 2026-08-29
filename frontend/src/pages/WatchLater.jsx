import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import { motion } from 'framer-motion';
import { Bookmark } from 'lucide-react';

export default function WatchLater() {
    const { user } = useContext(AuthContext);

    if (!user) return null;

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-[1400px] mx-auto px-6 md:px-12 py-12"
        >
            <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-white tracking-tight">Watch Later</h1>
                <Bookmark className="w-6 h-6 text-primary fill-primary" />
            </div>
            
            <p className="text-slate-400 mb-10 text-lg">Movies you've saved to watch later.</p>
            {user.watchLater && user.watchLater.length > 0 ? (
                <div className="flex flex-wrap gap-6 justify-start">
                    {user.watchLater.map(item => (
                        <MovieCard key={item._id || item} content={item} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-32 bg-slate-900/30 rounded-2xl border border-slate-800/50">
                    <p className="text-slate-300 text-xl font-medium">Nothing saved yet.</p>
                    <p className="text-slate-500 mt-2">Tap the bookmark on any movie to save it for later.</p>
                </div>
            )}
        </motion.div>
    );
}
