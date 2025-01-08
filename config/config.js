const mongoose=require("mongoose");
const mongoURI = process.env.MONGO_URI || "mongodb://avasyu:avasyu10@0.0.0.0:27017/Login_page";

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log("Database connected successfully");
})
.catch((err) => {
    console.error("Database connection error:", err);
});



