require('dotenv').config(); // load once, no try/catch

// 🔎 TEMP DEBUG — remove after this works
console.log('ENV CHECK:', {
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  DB_PORT: process.env.DB_PORT,
});

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'crm_system',
    port: Number(process.env.DB_PORT) || 3306,
  },
  dataDir: process.env.DATA_DIR || './data',
};
