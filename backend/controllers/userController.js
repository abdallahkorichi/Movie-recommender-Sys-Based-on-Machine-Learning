import User from '../models/User.js';
import Content from '../models/Content.js';

// @desc    Get authenticated user's full profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('favorites')
    .populate('watchLater');

  if (user) {
    const safeFavorites = (user.favorites || []).filter(item => item !== null);
    const safeWatchLater = (user.watchLater || []).filter(item => item !== null);

    res.json({
      _id:        user._id,
      name:       user.name,
      email:      user.email,
      appUserId:  user.appUserId,
      favorites:  safeFavorites,
      watchLater: safeWatchLater,
      ratings:    Object.fromEntries(user.ratings || new Map()),
      createdAt:  user.createdAt,
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Toggle a movie in the user's watch later list
// @route   POST /api/users/watch-later
// @access  Private
const toggleWatchLater = async (req, res) => {
  const { contentId } = req.body;

  if (!contentId) {
    return res.status(400).json({ message: 'contentId is required' });
  }

  const content = await Content.findById(contentId);
  if (!content) {
    return res.status(404).json({ message: 'Content not found' });
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const index = user.watchLater.findIndex(
    (id) => id.toString() === contentId
  );

  let added;
  if (index >= 0) {
    user.watchLater.splice(index, 1);
    added = false;
  } else {
    user.watchLater.push(contentId);
    added = true;
  }

  await user.save();
  await user.populate('watchLater');

  const safeWatchLater = (user.watchLater || []).filter(item => item !== null);

  res.json({ watchLater: safeWatchLater, added });
};

export { getUserProfile, toggleWatchLater };
