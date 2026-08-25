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




/*==== GET ALL COURSES API - GET /api/courses ====*/
app.get("/api/courses", async (req, res) => {

    try {

        const [courses] = await db.query(

            `SELECT
                id, course_name, course_category, duration, course_fee, trainer,
                course_mode, status, description, created_at, updated_at
             FROM courses
             ORDER BY id DESC`

        );


        res.json({

            success: true,
            courses: courses

        });


    } catch (error) {

        console.error(
            "❌ Get Courses Error:",
            error
        );


        res.status(500).json({

            success: false,
            message:
                "❌ Unable to fetch courses."

        });

    }

});



/*==== UPDATE COURSE API - PUT /api/courses/:id ====*/
app.put("/api/courses/:id", async (req, res) => {

    try {

        const courseId = req.params.id;

        const {
            courseName, category, duration, courseFee, trainer,
            mode, status, description
        } = req.body;


        /*--- Validate ID ---*/
        if (!courseId || isNaN(courseId)) {

            return res.status(400).json({

                success: false,
                message: "⚠️ Invalid course ID."

            });

        }


        /*--- Validate Course Name ---*/
        if (
            !courseName ||
            !courseName.trim()
        ) {

            return res.status(400).json({

                success: false,
                message: "⚠️ Please enter the course name."

            });

        }


        /* --- Check Course Exists ---*/
        const [existingCourse] = await db.query(

                `SELECT id FROM courses WHERE id = ?`,

                [courseId]

            );


        if (existingCourse.length === 0) {

            return res.status(404).json({

                success: false,
                message: "⚠️ Course not found."

            });

        }


        /*---- Convert Fee ---*/
        let fee = null;

        if (
            courseFee !== undefined &&
            courseFee !== null &&
            courseFee !== ""
        ) {

            fee = Number(courseFee);


            if (Number.isNaN(fee)) {

                return res.status(400).json({

                    success: false,
                    message: "⚠️ Please enter a valid course fee."

                });

            }

        }


        /*--- Update Course ---*/
        await db.query(

            `UPDATE courses

             SET
                course_name = ?, course_category = ?, duration = ?, course_fee = ?,
                trainer = ?, course_mode = ?, status = ?, description = ?

             WHERE id = ?`,

            [

                courseName.trim(),
                category || null,
                duration || null,
                fee,
                trainer || null,
                mode || null,
                status || "Active",
                description || null,
                courseId

            ]

        );


        /*--- Success ---*/
        res.json({

            success: true,
            message: "✅ Course updated successfully."

        });


    } catch (error) {

        console.error(
            "❌ Update Course Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "❌ Unable to update course."

        });

    }

});




/*==== DELETE COURSE API - DELETE /api/courses/:id ====*/
app.delete("/api/courses/:id", async (req, res) => {

    try {

        const courseId = req.params.id;

        /*--- Validate ID ---*/
        if (!courseId || isNaN(courseId)) {

            return res.status(400).json({

                success: false,
                message: "⚠️ Invalid course ID."

            });

        }


        /*--- Check Course Exists ---*/
        const [existingCourse] = await db.query(

                `SELECT id FROM courses WHERE id = ?`,

                [courseId]

            );


        if (existingCourse.length === 0) {

            return res.status(404).json({

                success: false,
                message: "⚠️ Course not found."

            });

        }


        /*--- Delete Course ---*/
        await db.query(

            `DELETE FROM courses WHERE id = ?`,

            [courseId]

        );


        /*--- Success --- */
        res.json({

            success: true,
            message: "✅ Course deleted successfully."

        });


    } catch (error) {

        console.error(
            "❌ Delete Course Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "❌ Unable to delete course."

        });

    }

});




/*==== ADD STUDENT ENQUIRY - POST /api/enquiries ====*/
app.post("/api/enquiries", async (req, res) => {

    try {

        const {
            studentName, mobile, email, gender, dateOfBirth, courseInterested, enquirySource,counsellor,
            enquiryDate, followUpDate, followUpTime, status, address, comments
        } = req.body;


        /*--- VALIDATION ---*/
        if (!studentName || !studentName.trim()) {

            return res.status(400).json({
                success: false,
                message: "Please enter the student name."
            });

        }


        if (!mobile || !mobile.trim()) {

            return res.status(400).json({
                success: false,
                message: "Please enter the mobile number."
            });

        }


        if (!courseInterested) {

            return res.status(400).json({
                success: false,
                message: "Please select the course interested."
            });

        }


        /*--- INSERT ENQUIRY ---*/
        const [result] = await db.query(

            `INSERT INTO student_enquiries
            (
                student_name, mobile, email, gender, date_of_birth, course_interested, enquiry_source,
                counsellor, enquiry_date, follow_up_date, follow_up_time, status, address, comments
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

            ,

            [
                studentName.trim(),
                mobile.trim(),
                email || null,
                gender || null,
                dateOfBirth || null,
                courseInterested,
                enquirySource || null,
                counsellor || null,
                enquiryDate || null,
                followUpDate || null,
                followUpTime || null,
                status || "New",
                address || null,
                comments || null
            ]

        );


        /*--- SUCCESS RESPONSE ---*/
        res.status(201).json({

            success: true,
            message: "✅ Student enquiry added successfully.",
            enquiryId: result.insertId

        });


    } catch (error) {

        console.error(
            "❌ Add Enquiry Error:",
            error
        );

        res.status(500).json({

            success: false,
            message: "❌ Unable to add student enquiry. Please try again."

        });

    }

});












/*-- Start server --*/
app.listen(PORT, () => {

    console.log(`CRM Server running on http://localhost:${PORT}`);

});