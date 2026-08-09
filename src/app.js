const express =require("express");
const cookieParser = require("cookie-parser");

const app=express();

/**
 * - Required Routes
 */

const authRouter= require("./routes/auth.routes");
const accountRouter = require("./routes/account.routes");
const transactionRoutes = require("./routes/transaction.routes");



/**
 * - Use Routes
 */
app.use(express.json());
app.use(cookieParser());


app.use("/api/auth",authRouter);
app.use("/api/accounts",accountRouter);
app.use('/api/transactions', transactionRoutes);

module.exports=app;