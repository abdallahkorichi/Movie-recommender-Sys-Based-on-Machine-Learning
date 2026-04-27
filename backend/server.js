import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';

// Load env vars
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.send('Recommendation System API is running...');
});

// Route mount points
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/recommendations', recommendationRoutes);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
})
