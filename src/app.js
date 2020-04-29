/* eslint-disable linebreak-style */
const express = require('express');
const app = express();
const db = require('./db');
const authy = require('authy')(process.env.TWILIOKEY);
const random_email = require('random-email');
const jsonwebtoken = require('jsonwebtoken');
const cors = require('cors');

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cors({
    origin: true
}))


app.post('/login', (req, res) => {
    const { phone } = req.body;
    db.query("SELECT phone, authyid, COUNT(*) as userCount FROM users WHERE phone = ?", [phone], (err, results) => {
        if(results[0].userCount > 0) {
            const authyid = results[0].authyid;
            requestLoginOtp(authyid, (result) => {
                if(result.success) {
                    const final = {
                        flow: 'login',
                        authyid
                    }
                    res.json(final);
                } else {
                    res.json({
                        message: "ERROR"
                    })
                }
            });
        } else {
            const email = random_email({domain: 'saath.web.app'});
            registerNew(phone, email, (response) => {
                authy.request_sms(response.user.id, true, (err, response1) => {
                    if(err) console.log(err);
                    else {
                        const final = {
                            authyid: response.user.id,
                            phone,
                            email
                        }
                        db.query("INSERT INTO users SET ?", final, (err, result) => {
                            res.json({
                                final,
                                response,
                                flow: 'register'
                            });
                        })
                    }
                })
            });
        }
    })
});

app.post('/verifyotp', (req, res) => {
    const { otp, authyid, flow } = req.body;
    authy.verify(authyid, otp, true, (err, results) => {
        if(err) {
            res.json(err)
        }
        else {
            res.json({
                results,
                authyid,
                flow
            })
        }
    })
});

app.post('/details', (req, res) => {
    const { first_name, last_name, age, authyid } = req.body;
    db.query("UPDATE users SET first_name = ?, last_name = ?, age = ? WHERE authyid = ?", [first_name, last_name, age, authyid], (err, results) => {
        if(err) console.log(err);
        else {
            const jwt = jsonwebtoken.sign({
                scope: 'users',
                authyid
            }, process.env.JWTKEY, {
                issuer: 'saath.web.app',
                expiresIn: '30d',
                subject: authyid
            });
            res.json({
                authyid,
                jwt
            });
        }
    })
});

app.post('/requestjwt', (req, res) => {
    const { authyid } = req.body;
    const jwt = jsonwebtoken.sign({
        scope: 'users',
        authyid
    }, process.env.JWTKEY, {
        issuer: 'saath.web.app',
        expiresIn: '30d',
        subject: authyid
    });
    res.json({
        authyid,
        jwt
    });
});

app.post('/create-store', (req, res) => {
    const { authyid, store_name, store_type, opening_time, closing_time } = req.body;
    const final = {
        authyid, store_name, store_type, opening_time, closing_time
    };
    db.query("INSERT INTO stores SET ?", final, (err, results) => {
        if(err) console.log(err);
        else {
            res.json({
                status: true,
                message: "STORE CREATED",
                store_id: results.insertId
            });
        }
    })
});

app.post('/set-lat-lng', (req, res) => {
    const { lat, lng, store_id } = req.body;
    db.query("UPDATE stores SET lat = ?, lng = ?, WHERE store_id = ?", [lat, lng, store_id], (err, results) => {
        if(err) console.log(err);
        else {
            res.json({
                status: true,
                message: "STORE LAT LNG UPDATED",
            });
        }
    })
});

app.get("/check_store/:authyid", (req, res) => {
    const { authyid } = req.params;
    db.query("SELECT COUNT(*) as store FROM stores WHERE authyid = ?", [authyid], (err, results) => {
        if(err) console.log(err);
        else{ 
            if(results[0].store > 0){
                res.json({
                    status: true
                });
            } else {
                res.json({
                    status: false
                })
            }
        }
    })
})

function registerNew(phone, email, callback) {
    authy.register_user(email, phone, '+91', false, (err, res) => {
        if(err) console.log(err);
        else {
            console.log(res);
            callback(res);
        }
    })
}

function requestLoginOtp(authyid, callback) {
    authy.request_sms(authyid, true, (err, result) => {
        if(err) console.log(err);
        else {
            callback(result);
        }
    })
}

module.exports = app;
