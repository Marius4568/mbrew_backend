import cron from 'node-cron';
import { postgresPool } from './config.js';

// Every day at midnight, flag guest users for deletion
cron.schedule('0 0 * * *', async () => {
  console.log('Flagging old guest users started');
  const client = await postgresPool.connect();
  try {
    const { rowCount: flaggedRows } = await client.query(`
        UPDATE users
        SET deleted = 1
        WHERE is_guest = 1 AND EXTRACT(MINUTE FROM NOW() - created_at) > 5
    `);

    console.log(`Flagged ${flaggedRows} old guest users`);
  } catch (err) {
    console.error(err);
  } finally {
    await client.release();
    console.log('Flagging old guest users finished');
  }
});

// Every hour, delete up to 100 flagged users
cron.schedule('0 * * * *', async () => {
  console.log('Deleting flagged users started');
  const client = await postgresPool.connect();
  try {
    const { rowCount: deletedRows } = await client.query(`
      DELETE FROM users
      WHERE deleted = 1
      LIMIT 100
    `);

    console.log(`Deleted ${deletedRows} flagged users`);
  } catch (err) {
    console.error(err);
  } finally {
    await client.release();
    console.log('Deleting flagged users finished');
  }
});
