import User from '../models/User.js';
import Counter from '../models/Counter.js';
import generateToken from '../utils/generateToken.js';
import isEmail from 'validator/lib/isEmail.js';

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!isEmail(normalizedEmail)) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (user && (await user.matchPassword(password))) {
      const token = generateToken(res, user._id);
      res.json({
        _id:       user._id,
        name:      user.name,
        email:     user.email,
        appUserId: user.appUserId,   // send to frontend so it can be cached
        token,
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!isEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Assign the next auto-increment integer ID for the Python ALS model
    const appUserId = await Counter.getNextId('userId');

    const user = await User.create({ name, email: normalizedEmail, password, appUserId });

    if (user) {
      const token = generateToken(res, user._id);
      res.status(201).json({
        _id:       user._id,
        name:      user.name,
        email:     user.email,
        appUserId: user.appUserId,
        token,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export { authUser, registerUser };
