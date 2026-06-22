require('dotenv').config();
require('./services/firebase'); // initialise Firebase Admin before anything else
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server listening on http://0.0.0.0:${PORT}`);
});
