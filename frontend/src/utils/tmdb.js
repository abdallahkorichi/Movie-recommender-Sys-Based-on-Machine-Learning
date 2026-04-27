const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

export const getTmdbImageUrl = (posterPath, size = "w500") => {
    if (!posterPath) return "https://via.placeholder.com/500x750?text=No+Poster";
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
};

export const fetchTmdbDetails = async (tmdbId) => {
    if (!tmdbId) return null;
    
    try {
        const response = await fetch(`${BASE_URL}/movie/${tmdbId}?api_key=${API_KEY}&language=en-US`);
        if (!response.ok) return null;
        
        const data = await response.json();
        return data;
    } catch (err) {
        console.error("TMDB Fetch Error:", err);
        return null;
    }
};
