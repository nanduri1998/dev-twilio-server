const express = require('express');
const router = express.Router();
const db = require('./db');
var AWS = require('aws-sdk');
AWS.config.update({region: 'ap-south-1'});
const bcrypt = require('bcrypt');
const saltRounds = 10;
const jsonwebtoken = require('jsonwebtoken');
const moment = require('moment');

router.post('/checkotp', (req, res) => {
    const { phone, otp } = req.body;
    db.query("SELECT otp, unique_code, user_id FROM users_login WHERE phone = ?", [phone], (err, results, fields) => {
        if(err) console.log(err);
        else {
            if (results[0].otp == otp) {
                res.status(200).json({
                    message: "USER VERIFIED",
                    status: true,
                    unique_code: results[0].unique_code,
                    user_id: results[0].user_id
                });
            } else {
                res.status(200).json({
                    message: "OTP NOT SAME",
                    status: false,
                    ERROR_NO: "ERROR_SIGNUP_1"
                });
            }
        }
    })
});

router.post('/resendotp', (req, res) => {
    const { phone } = req.body;
    sendSMStoUser(phone, 'register', res);
});

router.post('/userinfo', (req, res) => {
    const { first_name, last_name, email, password, unique_code, dob, gender } = req.body;
    const hash = bcrypt.hashSync(password, saltRounds);
    db.query("UPDATE users_login SET email = ?, password = ?, otp = NULL WHERE unique_code = ?", [email, hash, unique_code], (err, results, fields) => {
        if(err) console.log(err);
        else {
            const finalObj = {
                first_name,
                last_name,
                unique_code,
                dob, gender
            };
            db.query("INSERT INTO users_info SET ?", finalObj, (err1, results1, fields1) => {
                const jwt = jsonwebtoken.sign({
                    scope: 'users'
                }, '*}r{CJ}klU;aigqZgc7ORXyQpz]UC23I]@:43;X20Lj1*aBB9y38hLz>?[sLX62', {
                    expiresIn: '15d',
                    algorithm: 'HS256',
                    audience: 'users',
                    issuer: 'https://account.arcab.cloud',
                    subject: unique_code
                });
                if(err1) console.log(err1);
                else {
                    db.query("INSERT INTO users_progress SET unique_code = ?", [unique_code]);
                    const refresh_token = randomString(32, 32);
                    const expiry = moment().add(1, 'month').toDate();
                    db.query("UPDATE users_login SET refresh_token = ?, refresh_token_expiry = ? WHERE unique_code = ?", [refresh_token, expiry, unique_code]);
                    const activity_log = {
                        unique_code,
                        activity: 'Signed Up for arcab account',
                        activity_type: 'Sign Up'
                    }
                    db.query("INSERT INTO user_activity_log SET ?", activity_log);
                    res.status(200).json({
                        status: true,
                        message: "USER SIGNUP COMPLETE",
                        jwt,
                        unique_code,
                        refresh_token
                    })
                }
            })
        }
    })
})


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
