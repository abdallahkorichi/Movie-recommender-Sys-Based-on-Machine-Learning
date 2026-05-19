const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

export const CAST_LIMIT_CARD = 6;
export const CAST_LIMIT_MODAL = 8;

const detailsCache = new Map();

export const getTmdbImageUrl = (posterPath, size = "w500") => {
    if (!posterPath) return "https://via.placeholder.com/500x750?text=No+Poster";
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
};

export const getTopCast = (tmdbData, limit = CAST_LIMIT_CARD) =>
    (tmdbData?.credits?.cast ?? [])
        .sort((a, b) => a.order - b.order)
        .slice(0, limit);

export const fetchTmdbDetails = async (tmdbId) => {
    if (!tmdbId) return null;

    if (detailsCache.has(tmdbId)) {
        return detailsCache.get(tmdbId);
    }
    
    try {
        const response = await fetch(
            `${BASE_URL}/movie/${tmdbId}?api_key=${API_KEY}&language=en-US&append_to_response=credits`
        );
        if (!response.ok) return null;
        
        const data = await response.json();
        detailsCache.set(tmdbId, data);
        return data;
    } catch (err) {
        console.error("TMDB Fetch Error:", err);
        return null;
    }
};
