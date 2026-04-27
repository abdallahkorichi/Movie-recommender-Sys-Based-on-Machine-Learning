import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import MovieCard from '../components/MovieCard';
import { Loader2, SearchX } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Search() {
    const location = useLocation();
    const query = new URLSearchParams(location.search).get('q');
    
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSearchResults = async () => {
            if (!query) return;
            setLoading(true);
            try {
                // The backend automatically does a Regex case-insensitive search if we parse `search` query parameter
                const res = await axios.get(`/api/content?search=${encodeURIComponent(query)}&limit=40`);
                setResults(res.data.content);
            } catch (err) {
                console.error("Search Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSearchResults();
    }, [query]);

    if (!query) {
        return (
            <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-12 text-center text-slate-400">
                Please enter a search query in the navigation bar.
            </div>
        );
    }

    if (loading) {
        return <div className="min-h-[80vh] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    }

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-[1400px] mx-auto px-6 md:px-12 py-12"
        >
            <div className="mb-10">
                <h1 className="text-3xl font-bold text-white mb-2">
                    Search Results for <span className="text-primary">"{query}"</span>
                </h1>
                <p className="text-slate-400">Found {results.length} matches in the AuraFlix library.</p>
            </div>
            
            {results.length > 0 ? (
                <div className="flex flex-wrap gap-6 justify-start">
                    {/* The same highly cinematic MovieCard component used everywhere else */}
                    {results.map(movie => (
                        <MovieCard key={movie._id} content={movie} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 bg-slate-900/30 rounded-2xl border border-slate-800/50">
                    <SearchX className="w-16 h-16 text-slate-600 mb-4" />
                    <h3 className="text-xl font-medium text-slate-300">No movies found</h3>
                    <p className="text-slate-500 mt-2">Try searching for a different title or keyword.</p>
                </div>
            )}
        </motion.div>
    );
}
