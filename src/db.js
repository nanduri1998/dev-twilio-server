const mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'hackathon.cgzeeefjondj.us-east-1.rds.amazonaws.com',
    user: 'twilio',
    password: 'SNr6RmcyVu8QKeL1z0Uc',
    database: 'twilio'
});
    
    connection.connect(function(err) {
    if (err) {
        console.error('error connecting: ' + err.stack);
        return;
    }
    
    console.log('connected as id ' + connection.threadId);
});

module.exports = connection;
