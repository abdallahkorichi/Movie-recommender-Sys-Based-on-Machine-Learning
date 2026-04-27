import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import MovieCard from '../components/MovieCard';
import { Loader2, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';

const CATEGORY_MAP = {
    personalized: { title: 'AuraFlix Picks For You', filter: null },
    popular: { title: 'Global Trending', filter: null },
    action: { title: 'Action & Adventure', filter: 'Action' },
    scifi: { title: 'Sci-Fi & Fantasy', filter: 'Sci-Fi' },
    comedy: { title: 'Laugh Out Loud', filter: 'Comedy' },
    drama: { title: 'Drama & Thriller', filter: 'Drama' },
};

export default function CategoryView() {
    const { type } = useParams();
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    
    const ITEMS_PER_PAGE = 10;
    const categoryInfo = CATEGORY_MAP[type] || { title: 'Movies', filter: null };

    useEffect(() => {
        const fetchMovies = async () => {
            setLoading(true);
            try {
                let data = [];
                if (type === 'personalized') {
                    const res = await axios.get('/api/recommendations/personalized');
                    data = res.data;
                } else {
                    const res = await axios.get('/api/recommendations/popular?limit=100');
                    if (categoryInfo.filter) {
                        data = res.data.filter(m => m.genres && m.genres.includes(categoryInfo.filter));
                    } else {
                        data = res.data;
                    }
                }
                setMovies(data);
                setCurrentPage(1); // reset to first page on category change
            } catch (err) {
                console.error("Error fetching category movies:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMovies();
    }, [type, categoryInfo.filter]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center pt-24"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    }

    const totalPages = Math.ceil(movies.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentMovies = movies.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className="pt-24 pb-20 px-8 md:px-16 min-h-screen bg-background">
            <div className="mb-8 flex items-center gap-4">
                <Link to="/" className="p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{categoryInfo.title}</h1>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-12">
                {currentMovies.map(movie => (
                    <MovieCard key={movie._id} content={movie} />
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <span className="text-slate-300 font-medium">
                        Page <span className="text-white">{currentPage}</span> of {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            )}
            
            {movies.length === 0 && !loading && (
                <div className="text-center text-slate-400 mt-20">
                    <p className="text-xl">No movies found in this category.</p>
                </div>
            )}
        </div>
    );
}
