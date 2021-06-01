const express=require('express');
const router=express.Router();
const passport=require('passport');
const crypto=require('crypto');
const async=require('async');
const nodemailer=require('nodemailer');

let User= require('../models/usermodel');
function isAuthenticatedUser(req,res,next)
{
    if(req.isAuthenticated()){
        return next();
    }
    req.flash('error_msg','Please login first');
    res.redirect('/login');
}

router.get('/signup',isAuthenticatedUser,(req,res)=>{
    res.render('./users/signup.pug');
})

router.get('/login',(req,res)=>{
    res.render('./users/login.pug');
})

router.get('/logout',isAuthenticatedUser,(req,res)=>{
    req.logOut();
    req.flash('success_msg','You have been logged out');
    res.redirect('/login');
})
router.get('/forgot',(req,res)=>{
    res.render('./users/forgot.pug');
})
router.get('/reset/:token',(req,res)=>{
    User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now()}})
    .then(user=>{
        if(!user)
        {
            req.flash('error_msg','Password reset token is invalid or has been expired');
            return res.redirect('./users/forgot');
        }
        res.render('./users/newpassword.pug',{token: req.params.token});
    })
    .catch(err=>{
        req.flash('error_msg','ERROR: '+err);
        return res.redirect('/forgot');
    });
});
router.get('/changepassword',isAuthenticatedUser,(req,res)=>{
    res.render('./users/changepassword.pug');
})
router.get('/all',isAuthenticatedUser,(req,res)=>{
    User.find({})
        .then(users=>{
            res.render('./users/alluser',{users:users});
        })
        .catch(err=>{
            req.flash('error_msg','ERROR: '+err);
            return res.redirect('/all');
        });
})
router.get('/edit/:id',isAuthenticatedUser,(req,res)=>{
    let searchQuery= {_id:req.params.id};
    User.findOne(searchQuery)
        .then(user=>{
            res.render('./users/edituser',{user:user})
        })
        .catch(err=>{
            req.flash('error_msg','ERROR'+err);
            res.redirect('/users/alluser');
        })
})
// router.get('/username',isAuthenticatedUser,(req,res)=>{
//     res.render('/dashboard')
// })
router.post('/signup',isAuthenticatedUser,(req,res)=>{
    let {name,email,password}= req.body;
    let userData={
        name:name,
        email:email
    };

    User.register(userData, password,(err,user)=>{
        if(err)
        {
            req.flash('error_msg','Error: '+err);
            res.redirect('/signup');
        }
        req.flash('success_msg', 'Account created successfully');
        res.redirect('/signup');
    });
});
router.post('/login',passport.authenticate('local',{
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash:'Invalid email or password.Try Again'
}));
router.post('/forgot',(req,res,next)=>{
    let recoveryPassword = '';
    async.waterfall([
        (done) => {
            crypto.randomBytes(20, (err , buf) => {
                let token = buf.toString('hex');
                done(err, token);
            });
        },
        (token, done) => {
            User.findOne({email : req.body.email})
                .then(user => {
                    if(!user) {
                        req.flash('error_msg', 'User does not exist with this email.');
                        return res.redirect('/forgot');
                    }

                    user.resetPasswordToken = token;
                    user.resetPasswordExpires = Date.now() + 1800000; //   1/2 hours

                    user.save(err => {
                        done(err, token, user);
                    });
                })
                .catch(err => {
                    req.flash('error_msg', 'ERROR: '+err);
                    res.redirect('/forgot');
                })
        },
        (token, user) => {
            let smtpTransport = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user : process.env.GMAIL_EMAIL,
                    pass: process.env.GMAIL_PASSWORD
                }
            });

            let mailOptions = {
                to: user.email,
                from : 'Manvi Rohatgi manvi.rohatgi.14@gmail.com',
                subject : 'Recovery Email from Auth Project',
                text : 'Please click the following link to recover your passoword: \n\n'+
                        'http://'+ req.headers.host +'/reset/'+token+'\n\n'+
                        'If you did not request this, please ignore this email.'
            };
            smtpTransport.sendMail(mailOptions, err=> {
                req.flash('success_msg', 'Email send with further instructions. Please check that.');
                res.redirect('/forgot');
            });
        }

    ], err => {
        if(err) res.redirect('/forgot');
    });
});
router.post('/reset/:token', (req,res)=>{
    async.waterfall([
        (done)=>{
            User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now()}})
            .then(user=>{
            if(!user)
            {
                req.flash('error_msg','Password reset token is invalid or has been expired');
                return res.redirect('/forgot');
            }
            if(req.body.password!=req.body.confirmpassword)
            {
                req.flash('error_msg','Password does not match');
                return res.redirect('/forgot');
            }
            user.setPassword(req.body.password,err=>{
                user.resetPasswordToken=undefined;
                user.resetPasswordExpires=undefined;

                user.save(err=>{
                    req.logIn(user,err=>{
                        done(err,user);
                    })
                    
                });
            });
        
        })
        .catch(err=>{
            req.flash('error_msg','ERROR: '+err);
            res.redirect('/forgot');
        });
    },
    (user)=>{
        let smtpTransport = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user : process.env.Gmail_Email,
                pass: process.env.Gmail_Password
            }
        });

        let mailOptions = {
            to: user.email,
            from : 'Manvi Rohatgi manvi.rohatgi.14@gmail.com',
            subject : 'Recovery Email from Auth Project',
            text : 'Hello '+user.name+','+'\n\n'+
                    'Password for your account '+user.email+' has been changed successfully.'
        };
        smtpTransport.sendMail(mailOptions, err=> {
            req.flash('success_msg', 'Your Password has been changed successfully.');
            res.redirect('/login');
        });
    }
    ],err=>{
        res.redirect('/forgot');
    });
});
router.post('/changepassword',(req,res)=>{
    if(req.body.password!=req.body.confirmpassword)
    {
        req.flash('error_msg','Password does not match');
        return res.redirect('/changepassword');
    }
    User.findOne({email: req.user.email})
    .then(user=>{
        user.setPassword(req.body.password,err=>{
            user.save()
            .then(user=>{
                req.flash('success_msg','Password changed successfully');
                res.redirect('/changepassword');
            })
            .catch(err=>{
                req.flash('error_msg','Error: '+err);
                res.redirect('/changepassword');
            });
        });
    });
});
router.put('/edit/:id',(req,res)=>{
    let searchQuery={_id:req.params.id};
    User.updateOne(searchQuery,{$set:{
        name:req.body.name,
        email:req.body.email
    }})
    .then(user=>{
        req.flash('success_msg','User updated successfully');
        res.redirect('/all');
    })
    .catch(err=>{
        req.flash('error_msg','Error: '+err);
        res.redirect('/all');
    })
})
router.delete('/delete/:id',(req,res)=>{
    let searchQuery={_id:req.params.id};
    User.deleteOne(searchQuery)
        .then(user=>{
            req.flash('success_msg','User deleted successfully');
            res.redirect('/all');
        })
        .catch(err=>{
            req.flash('error_msg','Error: '+err);
            res.redirect('/all');
        })
})
module.exports = router;