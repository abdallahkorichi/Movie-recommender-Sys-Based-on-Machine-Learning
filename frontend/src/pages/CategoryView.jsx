import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import MovieCard from '../components/MovieCard';
import { Loader2, ChevronLeft, ChevronRight, ArrowLeft, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const CATEGORY_MAP = {
    personalized: { title: 'AuraFlix Picks For You', filter: null },
    popular: { title: 'Global Trending', filter: null },
    action: { title: 'Action & Adventure', filter: 'Action' },
    scifi: { title: 'Sci-Fi & Fantasy', filter: 'Sci-Fi' },
    comedy: { title: 'Laugh Out Loud', filter: 'Comedy' },
    drama: { title: 'Drama & Thriller', filter: 'Drama' },
};

const ITEMS_PER_PAGE = 15;

export default function CategoryView() {
    const { type } = useParams();
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const categoryInfo = CATEGORY_MAP[type] || { title: 'Movies', filter: null };
    const isGenreType = Boolean(categoryInfo.filter);

    useEffect(() => {
        setCurrentPage(1);
    }, [type]);

    useEffect(() => {
        if (isGenreType) return;

        const fetchAiMovies = async () => {
            setLoading(true);
            try {
                if (type === 'personalized') {
                    const res = await axios.get('/api/recommendations/personalized');
                    setMovies(res.data);
                    setTotalPages(Math.max(1, Math.ceil(res.data.length / ITEMS_PER_PAGE)));
                } else if (type === 'popular') {
                    const res = await axios.get('/api/recommendations/popular?limit=100');
                    setMovies(res.data);
                    setTotalPages(Math.max(1, Math.ceil(res.data.length / ITEMS_PER_PAGE)));
                } else {
                    setMovies([]);
                    setTotalPages(1);
                }
            } catch (err) {
                console.error('Error fetching category movies:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAiMovies();
    }, [type, isGenreType]);

    useEffect(() => {
        if (!isGenreType) return;

        const fetchGenrePage = async () => {
            setLoading(true);
            try {
                const res = await axios.get(
                    `/api/content?genre=${encodeURIComponent(categoryInfo.filter)}&limit=${ITEMS_PER_PAGE}&page=${currentPage}`
                );
                setMovies(res.data.content || []);
                setTotalPages(res.data.pages || 1);
            } catch (err) {
                console.error('Error fetching category movies:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchGenrePage();
    }, [type, categoryInfo.filter, isGenreType, currentPage]);

    if (loading) {
        return (
            <motion.div className="min-h-screen flex items-center justify-center pt-24">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </motion.div>
        );
    }

    const displayMovies = isGenreType
        ? movies
        : movies.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-[1400px] mx-auto px-6 md:px-12 py-12"
        >
            <div className="flex items-center gap-3 mb-10">
                <Link to="/" className="p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-4xl font-bold text-white tracking-tight">{categoryInfo.title}</h1>
            </div>

            {displayMovies.length > 0 ? (
                <div className="flex flex-wrap gap-6 justify-start">
                    {displayMovies.map(movie => (
                        <MovieCard key={movie._id} content={movie} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 bg-slate-900/30 rounded-2xl border border-slate-800/50 mt-8">
                    <Sparkles className="w-16 h-16 text-slate-600 mb-4" />
                    <h3 className="text-xl font-medium text-slate-300">No movies found.</h3>
                    <p className="text-slate-500 mt-2">Try another section from Home.</p>
                </div>
            )}

            {totalPages > 1 && (
                <motion.div className="flex items-center justify-center gap-4 mt-12">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-slate-800 text-white disabled:opacity-30 hover:bg-slate-700 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <span className="text-slate-300 font-medium">
                        Page <span className="text-white font-bold">{currentPage}</span> of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-slate-800 text-white disabled:opacity-30 hover:bg-slate-700 transition-colors"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </motion.div>
            )}
        </motion.div>
    );
}
