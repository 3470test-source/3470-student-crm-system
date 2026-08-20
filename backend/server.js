const express = require("express");
const cors = require("cors");
require("dotenv").config();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

/*-- Middleware --*/
app.use(cors());
app.use(express.json());


/*-- Test route --*/
app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "3470 Healthcare CRM Backend is running"
    });

});



/*==== Login Page - Script ====*/
app.post("/api/auth/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        /*-- Basic validation --*/
        if (!email || !password) {

            return res.status(400).json({

                success: false,
                message: "Email and password are required."

            });

        }


        /*-- TEMPORARY ADMIN LOGIN - Later this will come from the database. --*/

        const adminEmail = "admin@3470healthcare.com";

        const adminPassword = "Crm@123";


        if (
            email !== adminEmail ||
            password !== adminPassword
        ) {

            return res.status(401).json({

                success: false,
                message: "⚠️ Invalid email or password. Please check your credentials and try again."

            });

        }


        /*-- Create token --*/
        const token = jwt.sign(

            {
                email: adminEmail,
                role: "admin"
            },

            process.env.JWT_SECRET || "temporary-secret",

            {
                expiresIn: "1h"
            }

        );


        res.json({

            success: true,

            message: "Login successful.",

            token: token,

            user: {

                email: adminEmail,

                role: "admin"

            }

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Server error."

        });

    }

});




/*==== ADD COURSE API  POST /api/courses ====*/
app.post("/api/courses", async (req, res) => {

    try {

        const {
            courseName, category, duration, courseFee, trainer, mode,
            status, description
        } = req.body;


        /*-- Validation --*/
        if (!courseName || !courseName.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "⚠️ Please enter the course name."

            });

        }


        /*-- Check duplicate course --*/
        const [existingCourse] = await db.query(

            `SELECT id FROM courses WHERE course_name = ?`,

            [courseName.trim()]

        );


        if (existingCourse.length > 0) {

            return res.status(409).json({

                success: false,

                message:"⚠️ This course already exists."

            });

        }


        /*-- Convert fee --*/
        let fee = null;

        if (courseFee !== undefined && courseFee !== "") {

            fee = Number(courseFee);

            if (Number.isNaN(fee)) {

                return res.status(400).json({

                    success: false,

                    message:"⚠️ Please enter a valid course fee."

                });

            }

        }


        /*-- Insert course --*/
        const [result] = await db.query(

            `INSERT INTO courses
            (
                course_name, course_category, duration, course_fee, trainer,
                course_mode, status, description
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,

            [
                courseName.trim(),
                category || null,
                duration || null,
                fee,
                trainer || null,
                mode || null,
                status || "Active",
                description || null
            ]

        );


        /*-- Success --*/
        res.status(201).json({

            success: true,

            message:"✅ Course added successfully.",

            courseId:result.insertId

        });


    } catch (error) {

        console.error("❌ Add Course Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:"❌ Unable to add course. Please try again."

        });

    }

});












/*-- Start server --*/
app.listen(PORT, () => {

    console.log(`CRM Server running on http://localhost:${PORT}`);

});