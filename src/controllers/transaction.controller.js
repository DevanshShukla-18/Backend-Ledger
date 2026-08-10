const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.mdole");
const emailService = require("../services/email.service");
const accountModel = require("../models/account.model");
const mongoose = require("mongoose");

/**
 * - Create a new transaction
 * THE 10-STEP TRANSFER FLOW:
     * 1. Validate request
     * 2. Validate idempotency key
     * 3. Check account status
     * 4. Derive sender balance from ledger
     * 5. Create transaction (PENDING)
     * 6. Create DEBIT ledger entry
     * 7. Create CREDIT ledger entry
     * 8. Mark transaction COMPLETED
     * 9. Commit MongoDB session
     * 10. Send email notification
 */

async function createTransaction(req,res){

    const {fromAccount,toAccount,amount,idempotencyKey}=req.body;
  
    // 1)Validat Request

    if(!fromAccount || !toAccount || !amount || !idempotencyKey){
        return res.status(400).json({
            message: "Missing details from client side."
        })
    }

    const fromUserAccount = await accountModel.findOne({
        _id:fromAccount,
        user: req.user._id
    })

    const toUserAccount = await accountModel.findOne({
        _id: toAccount
    })


    if(!fromUserAccount || !toUserAccount){
        return res.status(400).json({
            message: "Wrong account details."
        })
    }

    // 2)Validate Idempotency Key

    const isIdempotencyKeyExist = await transactionModel.findOne({
        idempotencyKey: idempotencyKey
    });

    if(isIdempotencyKeyExist){
        if(isIdempotencyKeyExist.status === "COMPLETED"){
            return res.status(200).json({
                message: "Transaction already completed",
                transaction: isIdempotencyKeyExist
            })
        }

        else if(isIdempotencyKeyExist.status === "PENDING"){
            return res.status(200).json({
                message: "Transaction is still processing."
            })
        }

        else if(isIdempotencyKeyExist.status === "FAILED"){
            return res.status(409).json({
                message: "Previous transaction attempt failed, please try again."
            })
        }

        else if(isIdempotencyKeyExist.status === "REVERSED"){
            return res.status(409).json({
            message: "Transaction is reversed, please try again."
           })
        }
    }

    // 3) Check account status

    if(fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE"){
        return res.status(400).json({
            message: "Accounts are not active."
        })
    }

    // 4) Derive sender balance from ledger

    const balance = await fromUserAccount.getBalance();

    if(balance < amount){
        return res.status(400).json({
            message: `Insufficient balance. Current balance is ${balance}.Requested amount is ${amount}`
        })
    }

    // 5) Create transaction

    //All four should be happend simuntaneously so thats why we use startTransaction and session

    try{
        const session = await mongoose.startSession();
        session.startTransaction();

        const [transaction] = await transactionModel.create([{
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        }], { session });

        const debitLedgerEntry = await ledgerModel.create([{
            account: fromAccount,
            amount: amount,
            transaction: transaction._id,
            type: "DEBITED"
        }], {session});

        //Here we going to create a simulation in which some error occured and transaction takes time

        await (() =>{
            return new Promise((resolve) => setTimeout(resolve,15*1000))
        })()


        const creditLedgerEntry = await ledgerModel.create([{
            account: toAccount,
            amount: amount,
            transaction: transaction._id,
            type: "CREDITED"
        }], {session});

        transaction.status = "COMPLETED";
        await transaction.save({session});

        await session.commitTransaction();
        session.endSession();

        // 10)Send Email Notification

        await emailService.sendTransactionEmail(req.user.email, req.user.name, amount, toAccount);

        return res.status(201).json({
            message: "Transaction completed successfully.",
            transaction: transaction
        })
    }catch(err){
        return res.status(400).json({
            message: "Something went wrong , try again later."
        })
    }
}

async function createInitialFundsTransaction(req,res){

    const {toAccount, idempotencyKey, amount} = req.body;

    if(!toAccount || !idempotencyKey || !amount){
        return res.status(400).json({
            message: "Unauthorized, details are missing."
        })
    }

    const toUserAccount = await accountModel.findById({
        _id:toAccount
    });

    if(!toUserAccount){
        return res.status(400).json({
            message: "Invalid toAccount"
        })
    }

    const fromUserAccount = await accountModel.findOne({
        //systemUser: true,
        user: req.user._id
    })

    if(!fromUserAccount){
        return res.status(400).json({
            message: "System user account not found."
        })
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    const [transaction] = await transactionModel.create([{
        fromAccount: fromUserAccount._id,
        toAccount,
        amount,
        idempotencyKey,
        status: "PENDING"
    }],{session});

    const debitLedgerEntry = await ledgerModel.create([{
        account: fromUserAccount._id,
        amount,
        transaction: transaction._id,
        type: "DEBITED"
    }],{session})

    const creditLedgerEntry = await ledgerModel.create([{
        account: toAccount,
        amount,
        transaction: transaction._id,
        type: "CREDITED"
    }],{session})

    transaction.status = "COMPLETED";
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
        message: "Intial funds transaction completed.",
        transaction: transaction
    });
}



module.exports = {createTransaction , createInitialFundsTransaction};