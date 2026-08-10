const mongoose = require("mongoose");
const ledgerModel = require("./ledger.mdole")

const accountSchema = new mongoose.Schema({
    user: {
        type : mongoose.Schema.Types.ObjectId,
        ref : "user",
        required : [true , "Account must be associated with user."],
        index : true //Searching will be fast in mongodb if we use index
    },
    status: {
        type: String,
        enum : {
            values : ["ACTIVE", "FROZEN" , "CLOSED"],
            message : "Status can be either ACTIVE , FROZEN or CLOSED",
        },
        default : "ACTIVE"
    },
    currency : {
        type : String,
        required : [true , "Currency is required for creating ana ccount"],
        default  :"INR"
    }
},{
    timestamps :true
})


accountSchema.index({user :1,status : 1}); //compound status

accountSchema.methods.getBalance = async function(){

    const balanceData = await ledgerModel.aggregate([
        {$match : {account : this._id} },
        {
            $group: {
                _id: null,
                totalDebit :{
                    $sum:{
                        $cond:[
                            { $eq: ["$type", "DEBITED"]},
                            "$amount",
                            0
                        ]
                    }
                },
                totalCredit :{
                    $sum:{
                        $cond:[
                            { $eq: ["$type", "CREDITED"]},
                            "$amount",
                            0
                        ]
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                balance: {$subtract : ["$totalCredit","$totalDebit"]}
            }
        }
    ])

    if(balanceData.length === 0){
        return 0;
    }
       
    return balanceData[0].balance
}

const accountModel = mongoose.model("account",accountSchema);

module.exports = accountModel;