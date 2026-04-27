import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Models
import Content from './models/Content.js';

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected for Seeder: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting: ${error.message}`);
    process.exit(1);
  }
};

const importData = async () => {
  try {
    await connectDB();

    console.log('Clearing old Content...');
    await Content.deleteMany();

    // 1. Build link mapping (movieId -> tmdbId)
    console.log('Reading link.csv...');
    const linkPath = path.resolve('../AI-service/data/raw/link.csv');
    const linkMap = new Map();
    
    if (fs.existsSync(linkPath)) {
        const linkStream = fs.createReadStream(linkPath);
        const rlLink = readline.createInterface({ input: linkStream, crlfDelay: Infinity });
        
        let skipLink = true;
        for await (const line of rlLink) {
            if (skipLink) { skipLink = false; continue; }
            const match = line.split(',');
            if (match.length >= 3 && match[0] && match[2]) {
                linkMap.set(parseInt(match[0].trim()), parseInt(match[2].trim()));
            }
        }
        console.log(`Loaded ${linkMap.size} TMDB links into memory.`);
    } else {
        console.warn(`WARNING: ${linkPath} not found!`);
    }

    // 2. Parse Movies
    console.log('Reading movie.csv...');
    const csvPath = path.resolve('../AI-service/data/raw/movie.csv');
    
    if (!fs.existsSync(csvPath)) {
        console.error(`CSV File not found at: ${csvPath}`);
        process.exit(1);
    }

    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let isFirstLine = true;
    const contents = [];

    // Parse CSV line by line
    for await (const line of rl) {
      if (isFirstLine) {
        isFirstLine = false;
        continue; // skip header
      }

      // Handle CSV splitting correctly considering quotes e.g., 11,"American President, The (1995)",Comedy|Drama|Romance
      const match = line.match(/(?:^|,)(?:"([^"]*)"|([^,]*))/g);
      if (!match || match.length < 3) continue;

      const movieIdStr = match[0].replace(/^,/, '').trim();
      const titleStr = match[1] ? match[1].replace(/^,?"?|"?$/g, '').trim() : '';
      const genresStr = match[2] ? match[2].replace(/^,/, '').trim() : '';
      
      if (!movieIdStr) continue;

      const movieId = parseInt(movieIdStr);
      const tmdbId = linkMap.get(movieId) || null;
      let genres = genresStr !== '(no genres listed)' ? genresStr.split('|') : [];

      contents.push({
        movieId: movieId,
        tmdbId: tmdbId, // Link to TMDB!
        title: titleStr,
        type: 'movie', 
        description: 'Description pulled dynamically from TMDB.',
        genres: genres,
      });

      // Insert in chunks to avoid memory overflow for 20k+ docs
      if (contents.length === 1500) {
        await Content.insertMany(contents);
        console.log('Imported 1500 movies...');
        contents.length = 0; // empty it
      }
    }

    // Insert remaining 
    if (contents.length > 0) {
        await Content.insertMany(contents);
        console.log(`Imported remaining ${contents.length} movies...`);
    }

    console.log('TMDB Database Successfully Constructed!');
    process.exit(0);
  } catch (error) {
    console.error(`Import Error: ${error}`);
    process.exit(1);
  }
};

importData();
