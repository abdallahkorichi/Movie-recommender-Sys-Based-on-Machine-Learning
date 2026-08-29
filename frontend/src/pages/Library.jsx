import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';

export default function Library() {
    const { user } = useContext(AuthContext);

    if (!user) return null;

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-[1400px] mx-auto px-6 md:px-12 py-12"
        >
            <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-white tracking-tight">My List</h1>
                <Heart className="w-6 h-6 text-accent fill-accent" />
            </div>
            <p className="text-slate-400 mb-10 text-lg">Your favorite movies.</p>
            
            {user.favorites && user.favorites.length > 0 ? (
                <div className="flex flex-wrap gap-6 justify-start">
                    {user.favorites.map(fav => (
                        <MovieCard key={fav._id || fav} content={fav} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-32 bg-slate-900/30 rounded-2xl border border-slate-800/50">
                    <p className="text-slate-300 text-xl font-medium">Your list is currently empty.</p>
                    <p className="text-slate-500 mt-2">Rate a movie 4 or 5 stars to automatically add it to your collection!</p>
                </div>
            )}
        </motion.div>
    );
}
