import User from '../models/User.js';

// @desc    Get authenticated user's full profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id).populate('favorites');

  if (user) {
    const safeFavorites = (user.favorites || []).filter(item => item !== null);

    res.json({
      _id:       user._id,
      name:      user.name,
      email:     user.email,
      appUserId: user.appUserId,
      favorites: safeFavorites,
      ratings:   Object.fromEntries(user.ratings || new Map()),
      createdAt: user.createdAt,
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

export { getUserProfile };
