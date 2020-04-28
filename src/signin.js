const express = require('express');
const router = express.Router();
const db = require('./db');
var AWS = require('aws-sdk');
AWS.config.update({region: 'ap-south-1'});
const bcrypt = require('bcrypt');
const jsonwebtoken = require('jsonwebtoken');
const moment = require('moment');

router.post('/checkphone', (req, res) => {
    const { phone } = req.body;
    if (!checkPhone(phone)) {
        res.status(200).json({
            status: false,
            message: 'PHONE NOT VALID',
            ERROR_NO: 'ERROR_SIGNIN_1'
        });
    } else {
        checkUserInDatabase(phone, res);
    }
});

router.post('/resendotp', (req, res) => {
    const { phone } = req.body;
    sendSMStoUser(phone, 'login', res); 
});

router.post('/refreshtoken', (req, res) => {
    const { refresh_token, unique_code } = req.body;
    db.query("SELECT refresh_token, refresh_token_expiry FROM users_login WHERE unique_code = ?", [unique_code], (err, results, fields) => {
        if (refresh_token == results[0].refresh_token) {
            if (moment(results[0].refresh_token_expiry).isSameOrBefore(moment())) {
                const jwt = jsonwebtoken.sign({
                    scope: 'users'
                }, '*}r{CJ}klU;aigqZgc7ORXyQpz]UC23I]@:43;X20Lj1*aBB9y38hLz>?[sLX62', {
                    expiresIn: '15d',
                    algorithm: 'HS256',
                    audience: 'users',
                    issuer: 'https://account.arcab.cloud',
                    subject: unique_code
                });
                const refresh_token_new = randomString(32, 32);
                const expiry = moment().add(1, 'month').toDate();
                db.query("UPDATE users_login SET refresh_token = ?, refresh_token_expiry = ? WHERE unique_code = ?", [refresh_token_new, expiry, unique_code]);
                res.status(200).json({
                    status: true,
                    message: "NEW JWT CREATED",
                    jwt,
                    unique_code,
                    refresh_token: refresh_token_new
                });
            } else {
                res.json({
                    status: false,
                    message: "REFRESH TOKEN EXPIRED"
                });
            }
        } else {
            res.json({
                status: false,
                message: "REFRESH TOKEN INVALID"
            })
        }
    })
})

router.post('/signinotp', (req, res) => {
    const { phone, otp } = req.body;
    db.query("SELECT otp, unique_code FROM users_login WHERE phone = ?", [phone], (err, results, fields) => {
        if(err) console.log(err);
        else {
            if (results[0].otp == otp) {
                const unique_code = results[0].unique_code;
                db.query("UPDATE users_login SET otp = NULL where unique_code = ?", [unique_code]);
                const jwt = jsonwebtoken.sign({
                    scope: 'users'
                }, '*}r{CJ}klU;aigqZgc7ORXyQpz]UC23I]@:43;X20Lj1*aBB9y38hLz>?[sLX62', {
                    expiresIn: '15d',
                    algorithm: 'HS256',
                    audience: 'users',
                    issuer: 'https://account.arcab.cloud',
                    subject: unique_code
                });
                const refresh_token = randomString(32, 32);
                const expiry = moment().add(1, 'month').toDate();
                db.query("UPDATE users_login SET refresh_token = ?, refresh_token_expiry = ? WHERE unique_code = ?", [refresh_token, expiry, unique_code]);
                const activity_log = {
                    unique_code,
                    activity: 'Signed In using OTP to ' + phone,
                    activity_type: 'Sign In'
                }
                db.query("INSERT INTO user_activity_log SET ?", activity_log);
                res.status(200).json({
                    status: true,
                    message: "OTP VERIFIED",
                    jwt,
                    unique_code,
                    refresh_token
                });
            } else {
                res.status(200).json({
                    message: "OTP NOT SAME",
                    status: false,
                    ERROR_NO: "ERROR_SIGNIN_3"
                });
            }
        }
    })
});

router.post('/signinpassword', (req, res) => {
    const { email, password } = req.body;
    db.query("SELECT password, unique_code FROM users_login WHERE email = ?", [email], (err, results, fields) => {
        if (results.length > 0) {
            const hash = results[0].password;
            bcrypt.compare(password, hash).then(result => {
                if(result) {
                    const unique_code = results[0].unique_code;
                    const jwt = jsonwebtoken.sign({
                        scope: 'users'
                    }, '*}r{CJ}klU;aigqZgc7ORXyQpz]UC23I]@:43;X20Lj1*aBB9y38hLz>?[sLX62', {
                        expiresIn: '15d',
                        algorithm: 'HS256',
                        audience: 'users',
                        issuer: 'https://account.arcab.cloud',
                        subject: unique_code
                    });
                    const refresh_token = randomString(32, 32);
                    const expiry = moment().add(1, 'month').toDate();
                    db.query("UPDATE users_login SET refresh_token = ?, refresh_token_expiry = ? WHERE unique_code = ?", [refresh_token, expiry, unique_code]);
                    const activity_log = {
                        unique_code,
                        activity: 'Signed In using password using email ' + email,
                        activity_type: 'Sign In'
                    }
                    db.query("INSERT INTO user_activity_log SET ?", activity_log);
                    res.status(200).json({
                        status: true,
                        message: "PASSWORD VERIFIED",
                        jwt,
                        unique_code,
                        refresh_token
                    });
                } else {
                    res.status(200).json({
                        status: false,
                        message: 'PASSWORD ERROR',
                        ERROR_NO: 'ERROR_SIGNIN_4'
                    });
                }
            })
        }
    })
})


function checkPhone(phone) {
    var phoneno = /\+(9[976]\d|8[987530]\d|6[987]\d|5[90]\d|42\d|3[875]\d|2[98654321]\d|9[8543210]|8[6421]|6[6543210]|5[87654321]|4[987654310]|3[9643210]|2[70]|7|1)\d{1,14}$/;
    if((String(phone).match(phoneno))) {
        return true;
    } else {
        return false;
    }
}

function checkUserInDatabase(phone, res) {
    db.query("SELECT COUNT(phone) as userCount FROM users_login WHERE phone = ?", [phone], (err, results, fields) => {
        if (results[0].userCount === 0) {
            registerNewUser(phone, res);
        } else {
            sendSMStoUser(phone, 'login', res);
        }
    });

     
}

function sendSMStoUser(phone, type, res) {
    const pin = Math.floor(10000 + Math.random() * 99999);
    db.query('UPDATE users_login SET otp = ? WHERE phone = ?', [pin, phone], (err, results, fields) => {
        
        if (err) console.log(err);
        else {
            var params = {
                attributes: {
                    DefaultSMSType: 'Transactional',
                    DefaultSenderID: 'ARCAB'
                }
            };
            var phoneParams = {
                Message: 'Hi, your OTP to login to arcab is ' + pin + '. #MoveTogether',
                PhoneNumber: phone,
            }
            console.log(phone);
            var SMSattributes = new AWS.SNS().setSMSAttributes(params).promise();
            var publishSMS = new AWS.SNS().publish(phoneParams).promise();
            SMSattributes.then((attr) => {
                console.log(attr);
                publishSMS.then(data => {
                    if (data.MessageId) {
                        res.status(200).json({
                            status: true,
                            message: 'OTP SENT',
                            type
                        });
                    } else {
                        res.status(200).json({
                            status: false,
                            message: 'OTP ERROR',
                            ERROR_NO: 'ERROR_SIGNIN_2'
                        });
                    }
                }).catch(err => console.log(err))
            }).catch(err => console.log(err));

        }
    });

     

}

function registerNewUser(phone, res) {
    const random_10 = Math.random().toString(36).substr(2, 10);
    const uuid = uuidv4();
    const finalObj = {
        user_id: uuid,
        unique_code: random_10,
        phone
    };
    db.query("INSERT INTO users_login SET ?", finalObj, (err, results, fields) => {
        if(err) console.log(err);
        else {
            sendSMStoUser(phone, 'register', res);
        }
    })
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

var randomString = function (len, bits)
{
    bits = bits || 36;
    var outStr = "", newStr;
    while (outStr.length < len)
    {
        newStr = Math.random().toString(bits).slice(2);
        outStr += newStr.slice(0, Math.min(newStr.length, (len - outStr.length)));
    }
    return outStr.toUpperCase();
};

module.exports = router;
