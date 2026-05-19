import { useState, useEffect, useContext } from 'react';
import { fetchTmdbDetails, getTmdbImageUrl, getTopCast } from '../utils/tmdb';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Loader2, Bookmark, BookmarkCheck } from 'lucide-react';
import MovieModal from './MovieModal';
import { AuthContext } from '../context/AuthContext';

export default function MovieCard({ content, onSelectContent = null }) {
    const { user, ratings, updateRating, isInWatchLater, toggleWatchLater } = useContext(AuthContext);
    const [activeContent, setActiveContent] = useState(content);
    const [tmdbData, setTmdbData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hover, setHover] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const savedRating = ratings[activeContent._id] || null;
    const [ratingLoading, setRatingLoading] = useState(false);
    const [showSaved, setShowSaved] = useState(false);
    const [hoveredStar, setHoveredStar] = useState(0);

    useEffect(() => {
        setActiveContent(content);
    }, [content]);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            setLoading(true);
            const data = await fetchTmdbDetails(activeContent.tmdbId);
            if (isMounted) {
                setTmdbData(data);
                setLoading(false);
            }
        };
        load();
        return () => { isMounted = false; }
    }, [activeContent.tmdbId]);

    const handleRating = async (rating) => {
        try {
            setRatingLoading(true);
            await axios.post('/api/recommendations/interact', {
                contentId: activeContent._id,
                rating: rating
            });
            updateRating(activeContent._id, rating);
            setShowSaved(true);
            setTimeout(() => setShowSaved(false), 1500);
        } catch (err) {
            console.error("Failed to submit rating", err);
        } finally {
            setRatingLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-shrink-0 w-48 h-80 bg-slate-900 border border-slate-800 animate-pulse rounded-lg flex items-center justify-center">
               <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
            </div>
        )
    }

    if (!tmdbData) return null;

    const posterUrl = getTmdbImageUrl(tmdbData.poster_path, "w500");
    const savedForLater = isInWatchLater(activeContent._id);
    const cast = getTopCast(tmdbData);

    const handleWatchLater = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWatchLater(activeContent);
    };

    return (
        <>
            {isModalOpen && (
                <MovieModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    content={activeContent} 
                    tmdbData={tmdbData}
                    savedRating={savedRating}
                    onRate={handleRating}
                    onSelectSimilar={(movie) => {
                        setActiveContent(movie);
                        setShowSaved(false);
                        setHoveredStar(0);
                    }}
                />
            )}

            <motion.div 
                className="relative flex-shrink-0 w-48 h-80 rounded-lg overflow-hidden bg-slate-900 group cursor-pointer border border-slate-800 shadow-xl"
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => { setHover(false); setHoveredStar(0); }}
                onClick={() => {
                    if (onSelectContent) {
                        onSelectContent(content);
                        return;
                    }
                    setActiveContent(content);
                    setIsModalOpen(true);
                }}
                whileHover={{ scale: 1.05, zIndex: 10 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
            >
            <img 
                src={posterUrl} 
                alt={tmdbData.title} 
                className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-110" 
            />

            {user && (
                <button
                    onClick={handleWatchLater}
                    className={`absolute top-2 right-2 z-20 p-1.5 rounded-full backdrop-blur-md border transition-all ${
                        savedForLater
                            ? 'bg-primary/90 border-primary text-white opacity-100'
                            : 'bg-black/50 border-white/10 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-black/70 hover:text-white'
                    }`}
                    aria-label={savedForLater ? 'Remove from Watch Later' : 'Save for later'}
                >
                    {savedForLater ? (
                        <BookmarkCheck className="w-4 h-4 fill-current" />
                    ) : (
                        <Bookmark className="w-4 h-4" />
                    )}
                </button>
            )}
            
            <AnimatePresence>
                {hover && (
                    <motion.div 
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute bottom-0 left-0 right-0 p-3 bg-surface/90 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]"
                    >
                        <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 mb-1 drop-shadow-md">
                            {tmdbData.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 mb-2 drop-shadow-md">
                            <span className="text-[10px] font-black text-accent tracking-widest bg-accent/10 px-1 py-0.5 rounded">
                                {tmdbData.release_date?.split('-')[0]}
                            </span>
                            <span className="text-[10px] text-yellow-400 font-bold border border-yellow-400/20 bg-yellow-400/10 px-1 py-0.5 rounded">
                                ★ {tmdbData.vote_average?.toFixed(1)}
                            </span>
                            {tmdbData.genres?.slice(0, 2).map(g => (
                                <span key={g.id} className="text-[8px] font-medium text-slate-300 uppercase tracking-widest bg-slate-800/80 border border-slate-700 px-1 py-0.5 rounded">
                                    {g.name}
                                </span>
                            ))}
                        </div>

                        {cast.length > 0 && (
                            <motion.div
                                className="flex gap-2 overflow-x-auto pb-1 mb-1.5"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                {cast.map(actor => (
                                    <motion.div key={actor.id} className="flex flex-col items-center shrink-0 w-11">
                                        <img
                                            src={getTmdbImageUrl(actor.profile_path, 'w185')}
                                            alt={actor.name}
                                            className="w-7 h-7 rounded-full object-cover border border-slate-600"
                                        />
                                        <span className="text-[8px] text-slate-300 truncate w-full text-center mt-0.5">{actor.name.split(' ')[0]}</span>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}

                        <motion.div className="pt-1.5 border-t border-slate-600/50 flex flex-col gap-1">
                             <span className="text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors"
                                 style={{ color: showSaved ? '#4ade80' : savedRating ? '#facc15' : '#94a3b8' }}
                             >
                                 {showSaved ? '✓ Saved!' : savedRating ? `Your rating: ${savedRating}★` : 'Rate this'}
                             </span>
                             <motion.div className="flex gap-1 h-5 items-center">
                                 {[1, 2, 3, 4, 5].map((star) => (
                                     <button 
                                        key={star}
                                        disabled={ratingLoading}
                                        onMouseEnter={() => setHoveredStar(star)}
                                        onMouseLeave={() => setHoveredStar(0)}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleRating(star);
                                        }}
                                        className="hover:scale-125 transition-transform disabled:opacity-50"
                                     >
                                         <Star 
                                            className={`w-4 h-4 transition-all duration-150 ${
                                                hoveredStar >= star
                                                ? 'fill-yellow-300 text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.8)]'
                                                : savedRating >= star
                                                ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]'
                                                : 'fill-transparent text-slate-600'
                                            }`} 
                                         />
                                     </button>
                                 ))}
                             </motion.div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
        </>
    );
}
