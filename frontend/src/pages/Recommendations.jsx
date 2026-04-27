import { useState, useEffect } from 'react';
import axios from 'axios';
import MovieCard from '../components/MovieCard';
import { Loader2, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const ITEMS_PER_PAGE = 10;

export default function Recommendations() {
    const [personalized, setPersonalized] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                const res = await axios.get('/api/recommendations/personalized');
                setPersonalized(res.data);
            } catch (err) {
                console.error("Rec Data Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRecommendations();
    }, []);

    if (loading) {
        return <div className="min-h-[80vh] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    }

    const totalPages = Math.ceil(personalized.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentMovies = personalized.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-[1400px] mx-auto px-6 md:px-12 py-12"
        >
            <div className="flex items-center gap-3 mb-10">
                <h1 className="text-4xl font-bold text-white tracking-tight">For You</h1>
                <Sparkles className="w-6 h-6 text-yellow-400" />
            </div>
            
            <div className="flex flex-wrap gap-6 justify-start">
                {currentMovies.map(movie => (
                    <MovieCard key={movie._id} content={movie} />
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-12">
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
                </div>
            )}

            {personalized.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 bg-slate-900/30 rounded-2xl border border-slate-800/50 mt-8">
                    <Sparkles className="w-16 h-16 text-slate-600 mb-4" />
                    <h3 className="text-xl font-medium text-slate-300">Rate some movies first!</h3>
                    <p className="text-slate-500 mt-2">Your personalized feed will appear here once you rate movies.</p>
                </div>
            )}
        </motion.div>
    );
}
