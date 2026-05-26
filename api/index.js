const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health');
const evaluateRoutes = require('./routes/evaluate');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api', evaluateRoutes);

const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Form API listening on http://localhost:${port}`);
  });
}

module.exports = app;
