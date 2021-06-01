const express=require("express");
const app=express();
const path=require("path");
const dotenv= require('dotenv');
const mongoose= require('mongoose');
const session = require('express-session');
const methodOverride = require('method-override');
const flash = require('connect-flash');
const bodyparser= require('body-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const userRoutes=require('./routes/users');
const adminRoutes=require('./routes/admin');
let User= require('./models/usermodel');
dotenv.config({path: './config.env'});

mongoose.connect(process.env.DATABASE, {
    useNewUrlParser : true,
    useUnifiedTopology : true,
    useCreateIndex: true
}).then(con=>{
    console.log('Database connected successfully');
});

app.use('/static', express.static('static')); // For serving static files 
app.use(express.urlencoded());

// PUG SPECIFIC STUFF
app.set('view engine','pug');  // set the template engine as pug 
app.set('views', path.join(__dirname,'views'));  // set the views directory

app.use(bodyparser.urlencoded({extended:true}));
app.use(session({
    secret : "nodejs",
    resave : true,
    saveUninitialized:true
}));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy({usernameField: 'email'},User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//middleware for method override
app.use(methodOverride('_method'));

//middleware for connect flash
app.use(flash());
app.use((req, res, next)=> {
    res.locals.success_msg = req.flash(('success_msg'));
    res.locals.error_msg = req.flash(('error_msg'));
    res.locals.error= req.flash(('error'));
    res.locals.currentUser = req.user;
    next();
});
app.use(userRoutes);
app.use(adminRoutes);
const port= process.env.Port;
app.listen(port||3000,()=>{
    console.log("connected");
});