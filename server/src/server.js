import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/database.js';

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) throw new Error('MONGODB_URI and JWT_SECRET must be set');
connectDatabase()
  .then(() => app.listen(process.env.PORT || 5000, () => console.log(`API listening on ${process.env.PORT || 5000}`)))
  .catch((error) => { console.error('Database connection failed', error); process.exit(1); });
