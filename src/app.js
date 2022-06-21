const express = require('express');
const cors = require('cors');

const { Port } = require('./config');

const app = express();

app.use(express.json());
app.use(cors());

// Routes
app.use('/user', require('./routes/v1/user'));

// Testing
app.get('/', (req, res) => {
  res.send('Get request is working.');
});

app.all('*', (req, res) => res.status(404).send({ error: 'Page not found' }));

app.listen(Port, () => console.log(`Server is running on port ${Port}`));
