import mongoose from 'mongoose';

const contentSchema = new mongoose.Schema(
  {
    movieId: {
      type: Number,
      required: true,
      unique: true
    },
    tmdbId: {
      type: Number
    },
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['movie', 'tv'],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    releaseDate: {
      type: Date,
    },
    genres: [{
      type: String,
      required: true,
    }],
    averageRating: {
      type: Number,
      default: 0,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
    posterUrl: {
      type: String,
    }
  },
  { timestamps: true }
);

contentSchema.index({ title: 'text' });

const Content = mongoose.model('Content', contentSchema);
export default Content;
