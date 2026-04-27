import mongoose from 'mongoose';

/**
 * Counter model for auto-incrementing integer IDs.
 * Used to assign appUserId (integer) to each new user so the
 * Python ALS model (which expects integer userId) can work with them.
 *
 * The counters collection will have a single document: { _id: 'userId', seq: <n> }
 * Call Counter.getNextId('userId') atomically before each new user registration.
 */
const counterSchema = new mongoose.Schema({
  _id:  { type: String, required: true },  // name of the sequence, e.g. 'userId'
  seq:  { type: Number, default: 0 },
});

counterSchema.statics.getNextId = async function (name) {
  const doc = await this.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }  // create if it doesn't exist yet
  );
  return doc.seq;
};

const Counter = mongoose.model('Counter', counterSchema);
export default Counter;
