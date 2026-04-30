import { useState, useEffect } from 'react';
import axios from 'axios';
import MovieRow from '../components/MovieRow';
import { fetchTmdbDetails, getTmdbImageUrl } from '../utils/tmdb';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
    const [popular, setPopular] = useState([]);
    const [personalized, setPersonalized] = useState([]);
    const [loading, setLoading] = useState(true);

    // Auto-Slider Hero States
    const [heroMovies, setHeroMovies] = useState([]);
    const [currentHeroIndex, setCurrentHeroIndex] = useState(0);

    useEffect(() => {
        const fetchHomeData = async () => {
            try {
                const [popRes, persRes] = await Promise.all([
                    axios.get('/api/recommendations/popular?limit=100'),
                    axios.get('/api/recommendations/personalized')
                ]);

                setPopular(popRes.data);
                setPersonalized(persRes.data);

                // Fetch full TMDB Data for the Top 5 movies to drive the slider
                if (popRes.data.length > 0) {
                    const top5 = popRes.data.slice(0, 5);
                    const tmdbDataPromises = top5.map(movie => fetchTmdbDetails(movie.tmdbId));
                    const fullTmdbData = await Promise.all(tmdbDataPromises);
                    setHeroMovies(fullTmdbData.filter(data => data !== null));
                }
            } catch (err) {
                console.error("Home Data Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHomeData();
    }, []);

    // 10 Second Auto-Slider Hook
    useEffect(() => {
        if (heroMovies.length === 0) return;
        const interval = setInterval(() => {
            setCurrentHeroIndex(prevIndex => (prevIndex + 1) % heroMovies.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [heroMovies.length]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    }

    const heroItem = heroMovies[currentHeroIndex];

    const actionMovies = popular.filter(
        m => m.genres && (m.genres.includes('Action') || m.genres.includes('Adventure'))
    );
    const scifiMovies = popular.filter(m => m.genres && m.genres.includes('Sci-Fi'));
    const comedyMovies = popular.filter(m => m.genres && m.genres.includes('Comedy'));
    const dramaMovies = popular.filter(m => m.genres && m.genres.includes('Drama'));

    return (
        <div className="-mt-24 pb-20 overflow-x-hidden">
            {/* Cinematic Slider Hero Section */}
            {heroMovies.length > 0 && (
                <div className="relative w-full h-[75vh] min-h-[600px] flex items-end pb-24 group">
                    <AnimatePresence initial={false}>
                        <motion.div
                            key={currentHeroIndex} // Adding key triggers completely new slider mount
                            initial={{ x: "100%", opacity: 0.8 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: "-100%", opacity: 0.8 }}
                            transition={{ duration: 0.8, ease: "easeInOut" }}
                            className="absolute inset-0 z-0"
                        >
                            <img
                                src={getTmdbImageUrl(heroItem.backdrop_path, 'original')}
                                alt={heroItem.title}
                                className="w-full h-full object-cover opacity-50"
                            />
                            {/* Triple Gradients for perfect text blending */}
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />

                            <div className="absolute inset-0 flex items-end pb-24 px-8 md:px-16 max-w-4xl">
                                <div>
                                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)] tracking-tighter">
                                        {heroItem.title}
                                    </h1>

                                    <div className="flex flex-wrap items-center gap-3 mb-6 font-semibold text-slate-300">
                                        <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-md text-white border border-white/20 shadow-lg">
                                            {heroItem.release_date?.split('-')[0]}
                                        </span>
                                        <span className="text-primary tracking-[0.2em] uppercase text-sm font-extrabold drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                                            Top {currentHeroIndex + 1} Today
                                        </span>
                                        <span className="flex items-center gap-1 text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-md border border-yellow-400/20">
                                            ★ {heroItem.vote_average?.toFixed(1)}
                                        </span>
                                        <div className="flex items-center gap-2 border-l border-slate-600 pl-3">
                                            {heroItem.genres?.slice(0, 3).map(g => (
                                                <span key={g.id} className="bg-slate-800/80 backdrop-blur-md px-2 py-1 rounded border border-slate-700 text-[11px] uppercase tracking-widest text-slate-300 shadow-md">
                                                    {g.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <p className="text-lg md:text-xl text-slate-300 line-clamp-3 mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-relaxed max-w-3xl">
                                        {heroItem.overview}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Progress dots for visual slider feedback */}
                    <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 z-20">
                        {heroMovies.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentHeroIndex ? 'w-8 bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'w-2 bg-slate-600/50'}`}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Scrolling recommendation rows spanning directly underneath the hero */}
            <div className="relative z-20 space-y-6">
                <MovieRow title="AuraFlix Picks For You" movies={personalized} seeMoreLink="/recommendations" />
                <MovieRow title="Global Trending" movies={popular.slice(5)} seeMoreLink="/category/popular" />
                {actionMovies.length > 0 && <MovieRow title="Action & Adventure" movies={actionMovies} seeMoreLink="/category/action" />}
                {scifiMovies.length > 0 && <MovieRow title="Sci-Fi & Fantasy" movies={scifiMovies} seeMoreLink="/category/scifi" />}
                {comedyMovies.length > 0 && <MovieRow title="Laugh Out Loud" movies={comedyMovies} seeMoreLink="/category/comedy" />}
                {dramaMovies.length > 0 && <MovieRow title="Drama & Thriller" movies={dramaMovies} seeMoreLink="/category/drama" />}
            </div>
        </div>
    );
}
