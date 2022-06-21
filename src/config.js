require('dotenv').config();

module.exports = {
  Port: process.env.PORT || 8080,
  jwtSecret: process.env.JWT_SECRET,
  mySQLconfig: {
    database: process.env.MYSQL_DB,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    port: process.env.MYSQL_PORT,
    host: process.env.MYSQL_HOST,
  },
};
