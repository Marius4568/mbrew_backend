const express = require('express');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const { mySQLconfig, jwtSecret } = require('../../config');

const authSchemas = require('../../models/authSchemas');

const validation = require('../../middleware/validation');

const router = express.Router();

// User Authentication
router.post(
  '/register',
  validation(authSchemas, 'registerSchema'),
  async (req, res) => {
    try {
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
    INSERT INTO user (first_name, last_name, password, email)
    VALUES (${mysql.escape(req.body.firstName)}, ${mysql.escape(
        req.body.lastName
      )}, ${mysql.escape(hashedPassword)}, ${mysql.escape(req.body.email)})
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
    SELECT id, password FROM user
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
        return res.send({ msg: 'Successfully logged in', token });
      }

      return res.send({ error: 'incorrect email or password' });
    } catch (err) {
      console.log(err);
      return res.status(500).send({ error: 'Something went wrong' });
    }
  }
);

module.exports = router;
