const mysql = require('mysql');

  const dbConnection =   mysql.createConnection({
    host: "my-buy-buddy-server.mysql.database.azure.com",
  user: "buybuddyadmin",
  password: "Ramesh1@",
  database: "buybuddy"
});
dbConnection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
});







module.exports = dbConnection;