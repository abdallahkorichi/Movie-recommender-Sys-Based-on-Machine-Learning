import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedUser = async (userId) => {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }
  userCache.delete(userId);
  return null;
};

const setCachedUser = (userId, user) => {
  userCache.set(userId, { user, timestamp: Date.now() });
};

const protect = async (req, res, next) => {
  let token;

  token = req.headers.authorization;

  if (token && token.startsWith('Bearer')) {
    try {
      token = token.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      let user = await getCachedUser(decoded.userId);
      if (!user) {
        user = await User.findById(decoded.userId).select('-password');
        if (user) setCachedUser(decoded.userId, user);
      }

      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export { protect };
