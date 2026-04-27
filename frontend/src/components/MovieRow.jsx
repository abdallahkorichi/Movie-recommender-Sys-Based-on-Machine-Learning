import MovieCard from './MovieCard';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MovieRow({ title, movies, seeMoreLink }) {
    const rowRef = useRef(null);

    const scroll = (direction) => {
        if (rowRef.current) {
            const { scrollLeft, clientWidth } = rowRef.current;
            const scrollTo = direction === 'left' ? scrollLeft - clientWidth + 100 : scrollLeft + clientWidth - 100;
            rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
        }
    };

    if (!movies || movies.length === 0) return null;

    return (
        <div className="py-2 relative group">
            <div className="flex items-center justify-between px-8 md:px-16 mb-4">
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight drop-shadow-sm">{title}</h2>
                {seeMoreLink && (
                    <Link to={seeMoreLink} className="text-sm font-semibold text-primary hover:text-blue-400 hover:underline transition-colors flex items-center">
                        See More <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                )}
            </div>
            
            {/* Scroll Buttons - Visible only on Hover */}
            <button 
                onClick={() => scroll('left')} 
                className="absolute left-0 top-12 bottom-4 z-40 bg-gradient-to-r from-background to-transparent w-16 md:w-24 flex items-center justify-start pl-4 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out hover:pl-2"
            >
                <ChevronLeft className="w-10 h-10 text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.8)] hover:scale-125 transition-transform" />
            </button>
            <button 
                onClick={() => scroll('right')} 
                className="absolute right-0 top-12 bottom-4 z-40 bg-gradient-to-l from-background to-transparent w-16 md:w-24 flex items-center justify-end pr-4 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out hover:pr-2"
            >
                <ChevronRight className="w-10 h-10 text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.8)] hover:scale-125 transition-transform" />
            </button>

            <div 
                ref={rowRef} 
                className="flex gap-4 overflow-x-hidden scroll-smooth px-8 md:px-16 py-4"
            >
                {movies.map(movie => (
                    <MovieCard key={movie._id} content={movie} />
                ))}
            </div>
        </div>
    );
}
