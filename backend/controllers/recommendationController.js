import Content from '../models/Content.js';
import User from '../models/User.js';

// @desc    Get personalised recommendations from Python AI engine
// @route   GET /api/recommendations/personalized
// @access  Private
const getHybridRecommendations = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.appUserId) {
      return res.status(200).json([]); 
    }

    const response = await fetch(
      `http://127.0.0.1:8000/recommend/${user.appUserId}?k=20`
    );

    if (!response.ok) {
      throw new Error(`AI engine error: ${response.statusText}`);
    }

    const data = await response.json();

    // data.recommendations is [{movieId, title, genres}, ...]
    const pythonMovieIds = data.recommendations.map(r => r.movieId);

    // Fetch full enriched documents from MongoDB (gives frontend tmdbId, _id, etc.)
    const richMovies = await Content.find({ movieId: { $in: pythonMovieIds } });

    // Preserve the ranking order Python returned
    const lookup = Object.fromEntries(richMovies.map(m => [m.movieId, m]));
    const ordered = pythonMovieIds.map(id => lookup[id]).filter(Boolean);

    res.json(ordered);
  } catch (error) {
    console.error('Recommendations error:', error.message);
    res.status(500).json({ message: error.message });
  }
};


// @desc    Get movies similar to a specific movie (content-based)
// @route   GET /api/recommendations/similar/:contentId
// @access  Public
const getSimilarMovies = async (req, res) => {
  try {
    const content = await Content.findById(req.params.contentId);
    if (!content) return res.status(404).json({ message: 'Content not found' });

    const response = await fetch(
      `http://127.0.0.1:8000/similar/${content.movieId}?k=10`
    );
    if (!response.ok) throw new Error(`AI engine error: ${response.statusText}`);

    const data = await response.json();
    const pythonMovieIds = data.similar.map(r => r.movieId);

    const richMovies = await Content.find({ movieId: { $in: pythonMovieIds } });
    const lookup = Object.fromEntries(richMovies.map(m => [m.movieId, m]));
    const ordered = pythonMovieIds.map(id => lookup[id]).filter(Boolean);

    res.json(ordered);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Record a star rating and forward to Python ML engine for training
// @route   POST /api/recommendations/interact
// @access  Private
const recordInteraction = async (req, res) => {
  const { contentId, rating } = req.body;

  try {
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    }

    const [content, user] = await Promise.all([
      Content.findById(contentId),
      User.findById(req.user._id),
    ]);

    if (!content) return res.status(404).json({ message: 'Content not found' });

    if (!user.appUserId) {
      return res.status(400).json({
        message: 'User account does not have an appUserId. Please re-register.',
      });
    }

    // Forward rating to Python AI engine
    const payload = {
      userId:  user.appUserId,   // integer — what Python ALS expects
      movieId: content.movieId,  // integer from the MovieLens dataset
      rating:  rating,
      tmdbId:  content.tmdbId || null,
    };

    const response = await fetch('http://127.0.0.1:8000/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`AI engine rejected rating: ${errBody}`);
    }

    // Auto-add to favorites when user rates ≥ 4 stars
    if (rating >= 4 && !user.favorites.includes(contentId)) {
      user.favorites.push(contentId);
    }

    // Persist the star rating in MongoDB (cross-device consistency)
    user.ratings.set(contentId.toString(), rating);
    await user.save();

    res.status(201).json({ message: 'Rating logged to AI engine.' });
  } catch (error) {
    console.error('Rating error:', error.message);
    res.status(500).json({ message: error.message });
  }
};


// @desc    Get popular movies (cold-start / hero section)
// @route   GET /api/recommendations/popular
// @access  Public
const getPopularContent = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const response = await fetch(`http://127.0.0.1:8000/popular?n=${limit}`);
    if (!response.ok) throw new Error('AI engine error');

    const data = await response.json();
    const pythonMovieIds = data.popular.map(r => r.movieId);

    const richMovies = await Content.find({ movieId: { $in: pythonMovieIds } });
    const lookup = Object.fromEntries(richMovies.map(m => [m.movieId, m]));
    const ordered = pythonMovieIds.map(id => lookup[id]).filter(Boolean);

    res.json(ordered);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export {
  getHybridRecommendations,
  getSimilarMovies,
  recordInteraction,
  getPopularContent,
};
