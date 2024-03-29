import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config.js';

export default (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    req.user = jwt.verify(token, jwtSecret);

    return next();
  } catch (err) {
    return res.status(400).send({ error: 'User is not logged in.' });
  }
};
