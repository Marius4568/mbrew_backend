import express from 'express';
import cors from 'cors';
import userRoutes from './routes/v1/user.js';
import stripeRoutes from './routes/v1/stripe.js';
import './guestUserCleanup.js';
import { Port } from './config.js';

const app = express();

app.use(express.json());
app.use(cors());

// Routes
app.use('/user', userRoutes);
app.use('/stripe', stripeRoutes);

// Testing
app.get('/', (req, res) => {
  res.send({ msg: 'Get request is working.' });
});

app.all('*', (req, res) => res.status(404).send({ error: 'Page not found' }));

app.listen(Port, () => console.log(`Server is running on port ${Port}`));
