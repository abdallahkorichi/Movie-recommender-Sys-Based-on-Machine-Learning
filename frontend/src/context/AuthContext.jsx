import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // ratings: { [contentId]: starValue } — synced from MongoDB on login
    const [ratings, setRatings] = useState({});

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    const res = await axios.get('/api/users/profile');
                    setUser(res.data);
                    setRatings(res.data.ratings || {});
                } catch (err) {
                    console.error("Auth check failed", err);
                    localStorage.removeItem('token');
                    delete axios.defaults.headers.common['Authorization'];
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    const login = async (email, password) => {
        const res = await axios.post('/api/auth/login', { email, password });
        localStorage.setItem('token', res.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        const profileRes = await axios.get('/api/users/profile');
        setUser(profileRes.data);
        setRatings(profileRes.data.ratings || {});
    };

    const register = async (name, email, password) => {
        const res = await axios.post('/api/auth/register', { name, email, password });
        localStorage.setItem('token', res.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        const profileRes = await axios.get('/api/users/profile');
        setUser(profileRes.data);
        setRatings(profileRes.data.ratings || {});
    };

    const logout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        setRatings({});
    };

    const toggleFavoriteState = (contentId) => {
        setUser(prev => {
            if (!prev) return prev;
            const isFav = prev.favorites.some(f => (f._id || f) === contentId);
            return {
                ...prev,
                favorites: isFav
                    ? prev.favorites.filter(f => (f._id || f) !== contentId)
                    : [...prev.favorites, { _id: contentId }]
            };
        });
    };

    const isInWatchLater = (contentId) => {
        if (!user?.watchLater) return false;
        return user.watchLater.some(item => (item._id || item) === contentId);
    };

    const toggleWatchLater = async (content) => {
        if (!user || !content?._id) return;

        const contentId = content._id;
        const wasSaved = isInWatchLater(contentId);

        setUser(prev => ({
            ...prev,
            watchLater: wasSaved
                ? (prev.watchLater || []).filter(item => (item._id || item) !== contentId)
                : [...(prev.watchLater || []), content],
        }));

        try {
            const res = await axios.post('/api/users/watch-later', { contentId });
            setUser(prev => prev ? { ...prev, watchLater: res.data.watchLater } : prev);
        } catch (err) {
            console.error('Failed to toggle watch later', err);
            setUser(prev => ({
                ...prev,
                watchLater: wasSaved
                    ? [...(prev.watchLater || []), content]
                    : (prev.watchLater || []).filter(item => (item._id || item) !== contentId),
            }));
        }
    };

    // Called after a successful rating POST — updates local state immediately
    const updateRating = (contentId, starValue) => {
        setRatings(prev => ({ ...prev, [contentId]: starValue }));
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, toggleFavoriteState, isInWatchLater, toggleWatchLater, ratings, updateRating }}>
            {children}
        </AuthContext.Provider>
    );
};
