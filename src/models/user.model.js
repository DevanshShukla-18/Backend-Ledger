const mongoose=require("mongoose");
const {isEmail} = require("validator")
const bcrypt = require("bcryptjs")

const userSchema= new mongoose.Schema({
    email:{
        type: String,
        required: [true,"Email is required for creating a user"],
        trim: true,
        lowercase: true,
        unique: [true,"Email already exist"],
        validate: [isEmail, 'Please fill a valid email address']
    },
    name:{
        type: String,
        required: [true,"Name is required for creating account"],
    },
    password: {
        type: String,
        required: [true,"Password is required for creating account"],
        minlength:[6,"Password should be contain atleast 6 character"],
        select: false //Select help when we fetch data from mongoDB password doesnoty come untill we say
    }
},{
    timestamps: true
})

userSchema.pre("save", async function(){
    if(!this.isModified("password")){
        return ;
    }

    const hash= await bcrypt.hash(this.password,10);
    this.password=hash;

    return ;
})

userSchema.methods.comparePassword = async function (password){
    return await bcrypt.compare(password,this.password);
}

const userModel = mongoose.model("user",userSchema);

module.exports=userModel;