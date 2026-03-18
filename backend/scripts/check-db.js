const { Client } = require('pg');

async function checkDb() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'yield',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check users table structure
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users';
    `);

    console.log('Users table columns:');
    console.table(tableInfo.rows);

    // Check primary keys
    const pkInfo = await client.query(`
      SELECT a.attname
      FROM   pg_index i
      JOIN   pg_attribute a ON a.attrelid = i.indrelid
                           AND a.attnum = ANY(i.indkey)
      WHERE  i.indrelid = 'users'::regclass
      AND    i.indisprimary;
    `);

    console.log('Primary key columns:');
    console.table(pkInfo.rows);

    // Check sample data
    try {
      const sampleData = await client.query('SELECT * FROM users LIMIT 5');
      console.log('Sample data from users table:');
      console.table(sampleData.rows);
    } catch (error) {
      console.error('Error fetching sample data:', error.message);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDb();
