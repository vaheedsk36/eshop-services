import express from "express";
import {
    logRequest
} from "./middlewares/logger.js";

const app = express();
const PORT = 30000;

app.use(logRequest);
app.use('/',(req,res)=>{
    res.send('working');
})
app.listen(PORT,()=>{
    console.log(`App is listening at PORT:${PORT}`);
})