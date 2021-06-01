const mongoose= require('mongoose');
const passportlocalmongoose= require('passport-local-mongoose');

let userSchema= new mongoose.Schema({
    name: String,
    email: String,
    password: {
        type:String,
        select:false
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date
});
userSchema.plugin(passportlocalmongoose,{usernameField: 'email'});
module.exports=mongoose.model('User',userSchema);