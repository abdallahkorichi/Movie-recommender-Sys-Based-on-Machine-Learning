import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    // Integer ID used by the Python ALS model (auto-incremented).
    // Offset by 200,000 in the retrain pipeline to avoid collisions
    // with MovieLens userIds (max ~138,493 in the 25M dataset).
    appUserId: {
      type: Number,
      unique: true,
      sparse: true,
    },
    // Movies the user rated ≥ 4 stars (auto-added by recordInteraction)
    favorites: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content',
    }],
    // Star ratings persisted to MongoDB for cross-device consistency
    // { contentId (string) → rating (1–5) }
    ratings: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);
export default User;
