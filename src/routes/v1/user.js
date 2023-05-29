import express from 'express';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

import { mySQLconfig, jwtSecret } from '../../config.js';
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

      const con = await mysql.createConnection(mySQLconfig);

      const [email] = await con.execute(`
    SELECT email FROM user
    WHERE email = ${mysql.escape(req.body.email)}
    `);

      if (email.length === 1) {
        await con.end();
        return res.status(400).send({ error: 'User already exists.' });
      }

      const [data] = await con.execute(`
    INSERT INTO user (first_name, last_name, password, email, stripe_id)
    VALUES (${mysql.escape(req.body.firstName)}, ${mysql.escape(
        req.body.lastName
      )}, ${mysql.escape(hashedPassword)}, ${mysql.escape(
        req.body.email
      )}, ${mysql.escape(customer.id)})
    `);
      await con.end();

      if (!data.insertId) {
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
      const con = await mysql.createConnection(mySQLconfig);

      const [data] = await con.execute(`
    SELECT id, password, first_name, last_name, email FROM user
    WHERE email = ${mysql.escape(req.body.email)}
    LIMIT 1`);

      await con.end();

      if (data.length !== 1) {
        return res.status(400).send({ error: 'incorrect email or password' });
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

      return res.send({ error: 'incorrect email or password' });
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
    const guestEmail = `${username}@yourwebsite.com`;

    const customer = await stripe.customers.create({
      name: username,
      email: guestEmail,
    });

    const hashedPassword = await bcrypt.hashSync(password, 10);

    const con = await mysql.createConnection(mySQLconfig);

    const [data] = await con.execute(`
      INSERT INTO user (first_name, last_name, password, email, stripe_id, is_guest)
      VALUES (${mysql.escape(username)}, ${mysql.escape(
      username
    )}, ${mysql.escape(hashedPassword)}, ${mysql.escape(
      guestEmail
    )}, ${mysql.escape(customer.id)}, 1)
    `);

    await con.end();

    if (!data.insertId) {
      return res.status(500).send({
        error: 'Something wrong with the server. Please try again later',
      });
    }

    const token = jwt.sign({ id: data.insertId, email: guestEmail }, jwtSecret);

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

// Change password
router.post(
  '/change_password',
  isLoggedIn,
  validation(authSchemas, 'changePasswordSchema'),
  async (req, res) => {
    try {
      const con = await mysql.createConnection(mySQLconfig);
      const [data] = await con.execute(`
          SELECT id, password FROM user
          WHERE id=${mysql.escape(req.user.id)}
          LIMIT 1
          `);
      const isAuthed = bcrypt.compareSync(
        req.body.oldPassword,
        data[0].password
      );

      if (isAuthed) {
        const [dbRes] = await con.execute(`
            UPDATE user
            SET password = ${mysql.escape(
          bcrypt.hashSync(req.body.newPassword, 10)
        )}
            WHERE id=${mysql.escape(req.user.id)};
            `);
        if (!dbRes.affectedRows) {
          await con.end();
          return res
            .status(500)
            .send({ error: 'Something went wrong try again later' });
        }

        await con.end();
        return res.send({ msg: 'Password changed.' });
      }

      await con.end();

      return res.status(400).send({ error: 'Incorrect old password.' });
    } catch (err) {
      console.log(err);
      return res.status(500).send({ error: 'Server error try again later' });
    }
  }
);

// Get user data
router.get('/get_data', isLoggedIn, async (req, res) => {
  try {
    const con = await mysql.createConnection(mySQLconfig);

    const [data] = await con.execute(`
    SELECT first_name, last_name, 
    email, id, stripe_id
    FROM user
    WHERE id = ${mysql.escape(req.user.id)} 
`);

    if (data.length !== 1) {
      await con.end();
      return res
        .status(500)
        .send({ error: `Sorry couldn't retrieve such user.` });
    }
    await con.end();
    return res.send({ user: data });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Server error. Try again later.' });
  }
});

export default router;
