const express = require('express');
const router = express.Router();

//mongodb user model
const User = require('./../models/User');

//mongodb user verification model
const UserVerification = require('./../models/UserVerification');

//mongodb password reset model
const PasswordReset = require('./../models/PasswordReset');

//email handler
const nodemailer = require("nodemailer");

//unique string
const { v4: uuidv4 } = require("uuid");

//env variables
require("dotenv").config();

//path for specified static verified page
const path = require("path");

//password handler
const bcrypt = require("bcrypt");

//nodemailer stuff
let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS
    }
});
//testing success
transporter.verify((error, success) => {
    if (error) {
        console.log(error);
    } else {
        console.log("Ready for messages");
        console.log(success);
    }
});

router.post("/signup", (req, res) => {
    
    let { name, email, password, dateOfBirth } = req.body;
    console.log("Request Body:", req.body);
    if (name) {
        name = name.trim();
    } else {
        // Handle the case where name is not provided
        res.json({
            status: "FAILED",
            message: "Name is required"
        });
        return; // Exit the function to prevent further execution
    }
    email = email.trim();
    password = password.trim();
    dateOfBirth = dateOfBirth.toString().trim();

    if (name === '' || email === '' || password === '' || dateOfBirth === '') {
        res.json({
            status: "FAILED",
            message: "Empty input fields!"
        });
    } else if (!/^[a-zA-Z ]*$/.test(name)) {
        res.json({
            status: "FAILED",
            message: "Invalid name entered"
        });
    } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        res.json({
            status: "FAILED",
            message: "Invalid email entered"
        });
    } else if (!new Date(dateOfBirth).getTime()) {
        res.json({
            status: "FAILED",
            message: "Invalid date of birth entered"
        });
    } else if (password.length < 8) {
        res.json({
            status: "FAILED",
            message: "Password is too short!"
        });
    } else {
        //Checking if user already there
        User.find({ email }).then(result => {
            if (result.length) {
                //A user already exists
                res.json({
                    status: "FAILED",
                    message: "User with provided email already exists"
                });
            } else {
                //Try to create new user
                //password handling
                const saltRounds = 10;
                bcrypt.hash(password, saltRounds).then(hashedPassword => {
                    const newUser = new User({
                        name,
                        email,
                        password: hashedPassword,
                        dateOfBirth
                    });

                    newUser.save().then(result => {
                        //handle account verification
                        sendVerificationEmail(result, res);
                        res.redirect("/waiting.html");
                    })
                        .catch(err => {
                            res.json({
                                status: "FAILED",
                                message: "An error occurred while saving user account!"
                            });
                        });
                })
                    .catch(err => {
                        res.json({
                            status: "FAILED",
                            message: "An error occurred while hashing password!"
                        });
                    });
            }
        }).catch(err => {
            console.log(err);
            res.json({
                status: "FAILED",
                message: "An error occurred while checking for existing user!"
            });
        });
    }
});

const sendVerificationEmail = ({ _id, email }, res) => {
    //url to be used in the email
    const currentURL = "http://localhost:3000/";
    const uniqueString = uuidv4() + _id;

    const mailOptions = {
                        from: process.env.AUTH_EMAIL,
                        to: email,
                        subject: "Verify your email",
                        html: `<p>Verify your email address to complete the signup and login into your account.</p><p>This link <b>expires in 6 hours</b>.</p><p>Press <a href="${currentURL + 'api/verify/' + _id + '/' + uniqueString}">here</a> to proceed.</p>`
                    };

    //hash the uniquestring
    const saltRounds = 10;
    bcrypt.hash(uniqueString, saltRounds)
        .then((hashedUniqueString) => {
            //set values in userVerification collection
            const newUserVerification = new UserVerification({
                userID: _id,
                uniqueString: hashedUniqueString,
                createdAt: Date.now(),
                expiresAt: Date.now() + 21600000
            });
            newUserVerification.save()
                .then(() => {
                    

                    transporter.sendMail(mailOptions)
                        .then(() => {
                            //email sent and verification record saved
                            res.json({
                                status: "PENDING",
                                message: "Verification email sent"
                            });
                            
                            

                        })
                        .catch((error) => {
                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "Verification email failed!"
                            });
                        });
                })
                .catch((error) => {
                    console.log(error);
                    res.json({
                        status: "FAILED",
                        message: "Couldn't save verification email data!"
                    });
                });
        })
        .catch(() => {
            res.json({
                status: "FAILED",
                message: "An error occurred while hashing email data!"
            });
        });
};


//verify email
router.get("/verify/:userID/:uniqueString", (req, res) => {
    let { userID, uniqueString } = req.params;

    UserVerification.find({ userID })
        .then((result)=>{
            if(result.length>0){
                //User verification record exists so we proceed

                //check if record has expired
                const{expiresAt}=result[0];
                if(expiresAt<Date.now()){
                    //record has expired so delete it
                    UserVerification
                    .deleteOne({userID})
                    .then(result=>{
                        User.deleteOne({_id:userID})
                        .then(()=>{
                            let message = "Link has expired. Please sign up again.";
                            res.redirect(`/api/verified/error=true&message=${message}`);

                        })
                    })
                    .catch((error)=>{
                        console.log(error);
                        let message = "An error occured while clearing expired user verification record";
                        res.redirect(`/user/verified/error=true&message=${message}`);

                    });
                }else{
                    //valid record exists so we validate the user string
                    //First compare the hashed unique string

                    bcrypt.compare(uniqueString,result[0].uniqueString)
                    .then(result=>{
                        if(result){
                            //strings match

                            User.updateOne({_id:userID},{verified:true})
                            .then(()=>{
                                UserVerification.deleteOne({userID})
                                .then(()=>{
                                    res.sendFile(path.join(__dirname,"./../views/verified.html"));

                                })
                                .catch(error=>{
                                    console.log(error);
                                    let message = "Invalid verification details passed. Check your inbox.";
                                    res.redirect(`/api/verified/error=true&message=${message}`);
                                });
                            })
                            .catch(error=>{
                                console.log(error);
                                let message = "Invalid verification details passed. Check your inbox.";
                                res.redirect(`/api/verified/error=true&message=${message}`);
                            });


                        
                        }else{
                            //exisiting record but incorrect verification details passed
                            let message = "Invalid verification details passed. Check your inbox.";
                            res.redirect(`/api/verified/error=true&message=${message}`);
                        }
                    })
                    .catch(error=>{
                        let message = "An error occured while comparing unique strings.";
                        res.redirect(`/api/verified/error=true&message=${message}`);
                    });
                }



            }else{
                //User verification record doesn't exist
                let message = "Account record doesn't exist or has been verified already.Please sign up or log in";
                res.redirect(`/api/verified/error=true&message=${message}`);

            }
        })
        .catch((error) => {
            console.log(error);
            let message = "An error occurred while checking for existing user verification record";
            res.redirect(`/api/verified/error=true&message=${message}`);
        });
});

//Verified page route
router.get("/verified", (req, res) => {
    res.sendFile(path.join(__dirname, "./../views/verified.html"));
});

router.post("/login", (req, res) => {
    let { email, password } = req.body;
    email = email.trim();
    password = password.trim();

    if (email === "" || password === "") {
        res.json({
            status: "FAILED",
            message: "Empty credentials supplied"
        });
    } else {
        //Check if user exist
        User.find({ email })
            .then(data => {
                if (data.length) {
                    //User exists

                    //check if user is verified 
                    if(!data[0].verified){
                        res.json({
                            status: "FAILED",
                            message: "Email hasn't been verifiedyet. Check your inbox. "
                        });

                    }else{
                        const hashedPassword = data[0].password;
                    bcrypt.compare(password, hashedPassword).then(result => {
                        if (result) {
                            res.json({
                                status: "SUCCESS",
                                message: "Login successful",
                                data: data
                            });
                        } else {
                            res.json({
                                status: "FAILED",
                                message: "Invalid password entered!"
                            });
                        }
                    })
                        .catch(err => {
                            res.json({
                                status: "FAILED",
                                message: "An error occurred while comparing passwords!"
                            });
                        });
                    }

                    
                } else {
                    res.json({
                        status: "FAILED",
                        message: "Invalid credentials entered!"
                    });
                }
            })
            .catch(err => {
                res.json({
                    status: "FAILED",
                    message: "An error occurred while checking for existing user!"
                });
            });
    }
});

//Password reset stuff

router.post("/resetPasswordReset",(req,res)=>{
    const{email,redirectURL}=req.body;

    //check if email exists
    User.find({email})
    .then((data)=>{
        if(data.length){
            //user exists

            //check if user is verified

            if(!data[0].verified){
                res.json({
                    status: "FAILED",
                    message: "Email hasn't been verified. Check your inbox!"
                });
            }else{
                //reset password
                sendResetEmail(data[0],redirectURL,res);
            }

            

        }else{
            res.json({
                status: "FAILED",
                message: "No account with the entered email exists!"
            });
        }


    }).catch(error=>{
        console.log(error);
        res.json({
            status: "FAILED",
            message: "An error occurred while checking for existing user!"
        });
    });
});

//send password reset email

const sendResetEmail=({_id,email},redirectURL,res)=>{
    const resetString=uuidv4()+_id;

    //First, we clear all exisiting reset records
    PasswordReset.deleteMany({userID:_id})
    .then(result=>{
        //Reset records deleted successfully
        //Now we send the email

    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Password Reset",
        html: `<p>We heard that you lost the password.</p><p>Don't worry, use the link below to reset your password.</p> <p>This link <b>expires in 60 minutes</b>.</p><p>Press <a href="${redirectURL + '/' + _id + '/' + resetString}">here</a> to proceed.</p>`
    };

    //hash the reset string
    const saltRounds=10;
    bcrypt.hash(resetString,saltRounds)
    .then(hashedResetString=>{
        //set vlaues in password reset collection
        const newPasswordReset=new PasswordReset({
            userID: _id,
            resetString: hashedResetString,
            createdAt: Date.now(),
            expiresAt: Date.now()+3600000
        });

        newPasswordReset.save()
        .then(()=>{
            transporter.sendMail(mailOptions)
            .then(()=>{
                //reset email sent and password reset record saved
                res.json({
                    status: "PENDING",
                    message: "Password reset email sent"
                });
            })
            .catch(error=>{
                console.log(error);
                res.json({
                    status: "FAILED",
                    message: "Password reset email failed!"
                });
            })
            

        })
        .catch(error=>{
            console.log(error);
            res.json({
                status: "FAILED",
                message: "Couldn't save the password reset data!"
            });
        });
    })
    .catch(error=>{
        console.log(error);
        res.json({
            status: "FAILED",
            message: "An error occured while hashing the password reset data!"
        });
    });


    })
    .catch(error=>{
        console.log(error);
         res.json({
            status: "FAILED",
            message: "Clearing existing password reset records failed!"
        });
    
    });
};

//Actually reset the password
router.post("/resetPassword",(req,res)=>{
    let{userID,resetString,newPassword}=req.body;
    PasswordReset.find({userID})
    .then(result=>{
        if(result.length>0){

            const {exipresAt}=result[0];
            const hashedResetString=result[0].resetString;

            //checking for expired reset string
            if(expiresAt<Date.now()){
                PasswordReset.deleteOne({userID})
                .then(()=>{

                    res.json({
                        status: "FAILED",
                        message: "Password reset link has expired."
                    });
                })
                .catch(error=>{
                    console.log(error);
                    res.json({
                        status: "FAILED",
                        message: "Clearing password reset record failed."
                    });
                });
            }else{
                //valid record exists so we validate the reset string
                //First compare the hashed reset string
                bcrypt.compare(resetString,hashedResetString)
                .then((result)=>{
                    if(result){

                        //strings matched
                        //hash password again
                        const saltRounds=10;
                        bcrypt.hash(newPassword,saltRounds)
                        .then(hashedNewPassword=>{
                            //update user password
                            User.updateOne({_id:userID},{password:hashedNewPassword})
                            .then(()=>{
                                //update complete.Now delete reset record
                                PasswordReset.deleteOne({userID})
                                .then(()=>{
                                    //both user and reset record updated
                                    res.json({
                                        status: "SUCCESS",
                                        message: "Password has been reset."
                                    });
                                })
                                .catch(error=>{
                                    console.log(error);
                                    res.json({
                                        status: "FAILED",
                                        message: "An error occured while finalizing password reset."
                                    });
                                });

                            })
                            .catch(error=>{
                                console.log(error);
                                res.json({
                                    status: "FAILED",
                                    message: "Updating user password failed."
                                });
                            });
                        })
                        .catch(error=>{
                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "An error occured while hashing new password."
                            });
                        });

                    }else{
                        //Existing record but incorrect reset string passed.
                        res.json({
                            status: "FAILED",
                            message: "Invalid password reset details passed."
                        });
                    }

                })
                .catch(error=>{
                    res.json({
                        status: "FAILED",
                        message: "Comparing password reset strings failed."
                    });
                    
                });
            }


        }else{
            //Password reset record doesn't exist
            res.json({
                status: "FAILED",
                message: "Password reset request not found."
            });

        }

    })
    .catch(error=>{
        console.log(error);
         res.json({
            status: "FAILED",
            message: "Checking for existing password reset record failed."
        });
    
    });

});

module.exports = router;