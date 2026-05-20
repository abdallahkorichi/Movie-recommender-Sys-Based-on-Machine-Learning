import Content from '../models/Content.js';

// @desc    Search content with optional filters and pagination
// @route   GET /api/content?search=&type=&genre=&page=&limit=
// @access  Public
const getContent = async (req, res) => {
  const { type, genre, search, page = 1, limit = 20 } = req.query;
  const query = {};

  if (type)   query.type = type;
  if (genre) {
    const genreList = genre.split(',');
    query.genres = { $in: genreList };
  }
  if (search) query.title = { $regex: search, $options: 'i' };

  const parsedPage  = parseInt(page);
  const parsedLimit = parseInt(limit);
  const skip = (parsedPage - 1) * parsedLimit;

  const content = await Content.find(query).skip(skip).limit(parsedLimit);
  const total   = await Content.countDocuments(query);

  res.json({
    content,
    page:  parsedPage,
    pages: Math.ceil(total / parsedLimit),
    total,
  });
};

// @desc    Fetch single content document by MongoDB ID
// @route   GET /api/content/:id
// @access  Public
const getContentById = async (req, res) => {
  const content = await Content.findById(req.params.id);
  if (content) {
    res.json(content);
  } else {
    res.status(404).json({ message: 'Content not found' });
  }
};

export { getContent, getContentById };
