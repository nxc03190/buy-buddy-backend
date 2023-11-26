const mysql = require('mysql');

  const dbConnection =   mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "buybuddy",
});
dbConnection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
});







module.exports = dbConnection;