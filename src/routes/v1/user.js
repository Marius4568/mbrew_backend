import express from 'express';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

import { jwtSecret, postgresPool as pool } from '../../config.js';
import authSchemas from '../../models/authSchemas.js';
import isLoggedIn from '../../middleware/authorization.js';
import validation from '../../middleware/validation.js';

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// User Authentication
router.post(
  '/register',
  validation(authSchemas, 'registerSchema'),
  async (req, res) => {
    try {
      // Add customer on stripe
      const customer = await stripe.customers.create({
        name: `${req.body.firstName} ${req.body.lastName}`,
        email: req.body.email,
      });
      if (!customer.id) {
        return res.status(500).send({
          error: 'Something wrong with the server. Please try again later',
        });
      }

      const hashedPassword = await bcrypt.hashSync(req.body.password, 10);

      const { rows: email } = await pool.query(
        `SELECT email FROM users
         WHERE email = $1 AND deleted = false`,
        [req.body.email]
      );

      if (email.length === 1) {
        return res.status(400).send({ error: 'User already exists.' });
      }

      const { rowCount } = await pool.query(
        `INSERT INTO users (first_name, last_name, password, email, stripe_id, is_guest)
   VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.body.firstName,
          req.body.lastName,
          hashedPassword,
          req.body.email,
          customer.id,
          false, // is_guest
        ]
      );

      if (rowCount === 0) {
        return res.status(500).send({
          error: 'Something wrong with the server. Please try again later',
        });
      }

      return res.send({ msg: 'User created' });
    } catch (err) {
      console.log(err.message);
      return res.status(500).send({ error: 'Server error. Please try again' });
    }
  }
);

router.post(
  '/login',
  validation(authSchemas, 'loginSchema'),
  async (req, res) => {
    try {
      const { rows: data } = await pool.query(
        `
         SELECT id, password, first_name, last_name, email FROM users
        WHERE email = $1 AND deleted = false
        LIMIT 1`,
        [req.body.email]
      );

      if (data.length !== 1) {
        return res.status(400).send({ error: 'Incorrect email or password' });
      }

      const isAuthed = await bcrypt.compareSync(
        req.body.password,
        data[0].password
      );

      if (isAuthed) {
        const token = jwt.sign(
          { id: data[0].id, email: data[0].email },
          jwtSecret
        );

        const userData = {
          firstName: data[0].first_name,
          lastName: data[0].last_name,
          email: data[0].email,
        };

        return res.send({ msg: 'Successfully logged in', token, userData });
      }

      return res.send({ error: 'Incorrect email or password' });
    } catch (err) {
      console.log(err);
      return res.status(500).send({ error: 'Something went wrong' });
    }
  }
);

router.post('/guest_login', async (req, res) => {
  try {
    const username = `guest_${nanoid(10)}`;
    const password = nanoid(10);
    const guestEmail = `${username}@website.com`;

    const customer = await stripe.customers.create({
      name: username,
      email: guestEmail,
    });

    const hashedPassword = await bcrypt.hashSync(password, 10);

    const { rows } = await pool.query(
      `
  INSERT INTO users (first_name, last_name, password, email, stripe_id, is_guest)
  VALUES ($1, $2, $3, $4, $5, true)
  RETURNING id`,
      [username, username, hashedPassword, guestEmail, customer.id]
    );

    if (rows.length === 0) {
      return res.status(500).send({
        error: 'Something wrong with the server. Please try again later',
      });
    }

    const token = jwt.sign({ id: rows[0].id, email: guestEmail }, jwtSecret);

    const userData = {
      firstName: username,
      lastName: '',
      email: guestEmail,
    };

    return res.send({
      msg: 'Successfully logged in as guest',
      token,
      userData,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Server error. Please try again' });
  }
});

router.post(
  '/change_password',
  isLoggedIn,
  validation(authSchemas, 'changePasswordSchema'),
  async (req, res) => {
    try {
      const { rows: data } = await pool.query(
        `
          SELECT id, password FROM users
          WHERE id=$1 AND deleted = false
          LIMIT 1`,
        [req.user.id]
      );

      const isAuthed = bcrypt.compareSync(
        req.body.oldPassword,
        data[0].password
      );

      if (isAuthed) {
        const { rowCount: dbRes } = await pool.query(
          `
            UPDATE users
            SET password = $1
            WHERE id=$2`,
          [bcrypt.hashSync(req.body.newPassword, 10), req.user.id]
        );

        if (dbRes === 0) {
          return res
            .status(500)
            .send({ error: 'Something went wrong, try again later' });
        }

        return res.send({ msg: 'Password changed.' });
      }

      return res.status(400).send({ error: 'Incorrect old password.' });
    } catch (err) {
      console.log(err);
      return res.status(500).send({ error: 'Server error, try again later' });
    }
  }
);

router.get('/get_data', isLoggedIn, async (req, res) => {
  try {
    const { rows: data } = await pool.query(
      `
    SELECT first_name, last_name, 
    email, id, stripe_id
    FROM users
    WHERE id = $1 AND deleted = false`,
      [req.user.id]
    );

    if (data.length !== 1) {
      return res
        .status(500)
        .send({ error: `Sorry couldn't retrieve such user.` });
    }

    return res.send({ user: data });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Server error. Try again later.' });
  }
});

export default router;
