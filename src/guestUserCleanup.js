import cron from 'node-cron';
import mysql from 'mysql2/promise';
import { mySQLconfig } from './config.js';

// Every day at midnight, flag guest users for deletion
cron.schedule('0 0 * * *', async () => {
  console.log('Flagging old guest users started');
  try {
    const con = await mysql.createConnection(mySQLconfig);

    const [results] = await con.execute(`
        UPDATE user
        SET deleted = 1
        WHERE is_guest = 1 AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) > 5
    `);

    const flaggedRows = results.affectedRows;
    console.log(`Flagged ${flaggedRows} old guest users`);

    await con.end();
  } catch (err) {
    console.error(err);
  } finally {
    console.log('Flagging old guest users finished');
  }
});

// Every hour, delete up to 100 flagged users
cron.schedule('0 * * * *', async () => {
  console.log('Deleting flagged users started');
  try {
    const con = await mysql.createConnection(mySQLconfig);

    const [results] = await con.execute(`
      DELETE FROM user
      WHERE deleted = 1
      LIMIT 100
    `);

    const deletedRows = results.affectedRows;
    console.log(`Deleted ${deletedRows} flagged users`);

    await con.end();
  } catch (err) {
    console.error(err);
  } finally {
    console.log('Deleting flagged users finished');
  }
});
