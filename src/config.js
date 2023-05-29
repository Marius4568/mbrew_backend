import dotenv from 'dotenv';

dotenv.config();

const Port = process.env.PORT || 8080;
const jwtSecret = process.env.JWT_SECRET;
const mySQLconfig = {
  database: process.env.MYSQL_DB,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  port: process.env.MYSQL_PORT,
  host: process.env.MYSQL_HOST,
};

export { Port, jwtSecret, mySQLconfig };
