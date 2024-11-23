const express = require('express');
const session = require('express-session');
const sql = require('mssql');
const passport = require('passport');
const bodyParser = require('body-parser');
const patientRoutes = require('./routes/patientRoutes');
const dotenv = require('dotenv');
dotenv.config({path:'process.env'});

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    enableArithAbort: true
  }
};
const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;
app.use(bodyParser.json());

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(path.join('public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

sql.connect(dbConfig).then(pool => {
  if (pool.connected) {
    console.log('Connected to MSSQL');
  }
}).catch(err => {
  console.error('Database connection failed: ', err);
});

app.use('/api', patientRoutes)