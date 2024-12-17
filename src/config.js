const config = {
  development: {
      port: 3000,
      host: 'localhost',
      storageDir: './storage'
  },
  production: {
      port: process.env.PORT || 3000,
      host: process.env.HOST || '0.0.0.0',
      storageDir: process.env.STORAGE_DIR || '/var/thing-system/storage'
  }
};

const env = process.env.NODE_ENV || 'development';
module.exports = config[env]; 