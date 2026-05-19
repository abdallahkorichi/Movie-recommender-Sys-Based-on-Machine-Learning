import { useEffect, useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Star, Check, Loader2, Bookmark, BookmarkCheck } from 'lucide-react';
import { getTmdbImageUrl, getTopCast, CAST_LIMIT_MODAL } from '../utils/tmdb';
import axios from 'axios';
import MovieCard from './MovieCard';
import { AuthContext } from '../context/AuthContext';

export default function MovieModal({ isOpen, onClose, content, tmdbData, savedRating, onRate, onSelectSimilar }) {
    const { isInWatchLater, toggleWatchLater } = useContext(AuthContext);
    const [ratingLoading, setRatingLoading] = useState(false);
    const [showSaved, setShowSaved] = useState(false);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [similarMovies, setSimilarMovies] = useState([]);
    const [similarLoading, setSimilarLoading] = useState(false);

    useEffect(() => {
        if (isOpen && content?._id) {
            setSimilarMovies([]);
            const fetchSimilar = async () => {
                setSimilarLoading(true);
                try {
                    const res = await axios.get(`/api/recommendations/similar/${content._id}`);
                    setSimilarMovies(res.data);
                } catch (err) {
                    console.error("Failed to fetch similar movies:", err);
                } finally {
                    setSimilarLoading(false);
                }
            };
            fetchSimilar();
        }
    }, [isOpen, content?._id]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; }
    }, [isOpen]);

    if (!tmdbData) return null;

    const savedForLater = isInWatchLater(content._id);
    const cast = getTopCast(tmdbData, CAST_LIMIT_MODAL);

    const handleRating = async (star) => {
        try {
            setRatingLoading(true);
            await onRate(star);
            setShowSaved(true);
            setTimeout(() => setShowSaved(false), 2000);
        } finally {
            setRatingLoading(false);
        }
    };

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer border-none"
                    />

                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row z-10 max-h-[90vh]"
                    >
                        <button 
                            onClick={onClose}
                            className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black border border-white/10 rounded-full text-slate-300 hover:text-white transition-all backdrop-blur-md"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="hidden md:block w-1/3 relative shrink-0">
                            <img src={getTmdbImageUrl(tmdbData.poster_path, 'w500')} alt={tmdbData.title} className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1 flex flex-col overflow-y-auto w-full relative">
                            <div className="relative w-full h-56 shrink-0 border-b border-slate-700/50">
                                <img src={getTmdbImageUrl(tmdbData.backdrop_path, 'w780')} alt={tmdbData.title} className="w-full h-full object-cover opacity-60" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
                                <div className="absolute bottom-0 left-0 p-6 w-full">
                                    <h2 className="text-3xl md:text-4xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] mb-2 tracking-tight line-clamp-2">{tmdbData.title}</h2>
                                    <div className="flex flex-wrap items-center gap-3 drop-shadow-md">
                                        <span className="text-sm font-black text-accent bg-accent/20 border border-accent/20 px-2 py-0.5 rounded shadow-lg backdrop-blur-md">{tmdbData.release_date?.split('-')[0]}</span>
                                        <span className="flex items-center gap-1 text-sm text-yellow-400 font-bold border border-yellow-400/20 bg-yellow-400/10 px-2 py-0.5 rounded shadow-lg backdrop-blur-md">
                                            <Star className="w-3 h-3 fill-current" /> {tmdbData.vote_average?.toFixed(1)}
                                        </span>
                                        {tmdbData.runtime && (
                                            <span className="flex items-center gap-1 text-xs font-semibold text-slate-300 bg-slate-800/80 border border-slate-700 backdrop-blur-md px-2 py-1.5 rounded shadow-lg">
                                                <Clock className="w-3 h-3" /> {Math.floor(tmdbData.runtime / 60)}h {tmdbData.runtime % 60}m
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 md:p-8 flex flex-col gap-6 flex-1">
                                <p className="text-slate-300 leading-relaxed text-lg font-medium">{tmdbData.overview || "No overview available."}</p>

                                <div className="flex flex-wrap gap-2">
                                    {tmdbData.genres?.map(g => (
                                        <span key={g.id} className="text-[11px] uppercase font-bold tracking-[0.2em] text-slate-400 border border-slate-700 bg-slate-800/50 px-3 py-1.5 rounded">{g.name}</span>
                                    ))}
                                </div>

                                {cast.length > 0 && (
                                    <div>
                                        <h3 className="text-xs text-slate-400 uppercase tracking-[0.2em] font-black mb-3">Cast</h3>
                                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                                            {cast.map(actor => (
                                                <div key={actor.id} className="flex flex-col items-center shrink-0 w-16">
                                                    <img
                                                        src={getTmdbImageUrl(actor.profile_path, 'w185')}
                                                        alt={actor.name}
                                                        className="w-12 h-12 rounded-full object-cover border-2 border-slate-600"
                                                    />
                                                    <span className="text-[10px] text-slate-300 truncate w-full text-center mt-1.5">{actor.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => toggleWatchLater(content)}
                                    className={`flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                                        savedForLater
                                            ? 'bg-primary/20 border-primary/50 text-primary hover:bg-primary/30'
                                            : 'bg-slate-800/50 border-slate-600 text-slate-300 hover:border-primary/50 hover:text-white'
                                    }`}
                                >
                                    {savedForLater ? (
                                        <><BookmarkCheck className="w-4 h-4 fill-current" /> Saved</>
                                    ) : (
                                        <><Bookmark className="w-4 h-4" /> Save for later</>
                                    )}
                                </button>

                                {/* Rating — reads savedRating from MongoDB context via MovieCard */}
                                <div className="mt-4 bg-slate-800/30 border border-slate-700/50 p-6 rounded-2xl flex flex-col items-center gap-3 shadow-inner">
                                    <h3 className="text-xs text-slate-400 uppercase tracking-[0.2em] font-black">
                                        {showSaved ? "Rating Saved!" : savedRating ? `Your Rating: ${savedRating} ★` : "Rate This Movie"}
                                    </h3>
                                    {showSaved ? (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2 text-green-400 bg-green-400/10 border border-green-400/20 px-4 py-2 rounded-lg">
                                            <Check className="w-5 h-5" /><span className="text-lg font-bold">Rating saved!</span>
                                        </motion.div>
                                    ) : (
                                        <div className="flex gap-2">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <button key={star} disabled={ratingLoading}
                                                    onMouseEnter={() => setHoveredStar(star)}
                                                    onMouseLeave={() => setHoveredStar(0)}
                                                    onClick={() => handleRating(star)}
                                                    className="hover:scale-110 transition-transform disabled:opacity-50"
                                                >
                                                    <Star className={`w-10 h-10 transition-colors ${
                                                        hoveredStar >= star ? 'fill-yellow-300 text-yellow-300 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]'
                                                        : savedRating >= star ? 'fill-yellow-400 text-yellow-400'
                                                        : 'fill-slate-800 text-slate-600'
                                                    }`} />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* More Like This */}
                                <div className="mt-8 pt-8 border-t border-slate-700/50">
                                    <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">More Like This</h3>
                                    {similarLoading ? (
                                        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                                    ) : similarMovies.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {similarMovies.slice(0, 16).map(movie => (
                                                <div key={movie._id}>
                                                    <MovieCard
                                                        content={movie}
                                                        onSelectContent={onSelectSimilar}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 text-center py-4">No similar movies found.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
}
