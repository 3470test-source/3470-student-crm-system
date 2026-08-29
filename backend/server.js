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




/*==== GET ALL ENQUIRIES - GET /api/enquiries ====*/
app.get("/api/enquiries", async (req, res) => {

    try {

        const {
            search = "", status = "", course = "", counsellor = ""
        } = req.query;


        let sql = `
            SELECT
                id, student_name, mobile, email, gender, date_of_birth, course_interested AS course,
                enquiry_source, counsellor, enquiry_date, follow_up_date, follow_up_time, status,
                address, comments, created_at, updated_at

            FROM student_enquiries

            WHERE 1 = 1
        `;


        const params = [];


        /*-- SEARCH --*/
        if (search.trim() !== "") {

            sql += `
                AND (
                    student_name LIKE ?
                    OR mobile LIKE ?
                    OR email LIKE ?
                )
            `;

            const searchValue = `%${search.trim()}%`;

            params.push(
                searchValue,
                searchValue,
                searchValue
            );
        }

        
        /*-- STATUS FILTER --*/
        if (
            status &&
            status !== "-- All Status --"
        ) {

            sql += `
                AND status = ?
            `;

            params.push(status);
        }


        /*-- COURSE FILTER --*/
        if (
            course &&
            course !== "-- All Courses --"
        ) {

            sql += `
                AND course_interested = ?
            `;

            params.push(course);
        }


        /*-- COUNSELLOR FILTER --*/
        if (
            counsellor &&
            counsellor !== "-- All Counsellors --"
        ) {

            sql += `
                AND counsellor = ?
            `;

            params.push(counsellor);
        }


        /*-- ORDER --*/
        sql += `
            ORDER BY id DESC
        `;


        const [rows] = await db.query(
            sql,
            params
        );


        console.log(
            `✅ Enquiries fetched: ${rows.length}`
        );


        res.json(rows);


    } catch (error) {

        console.error(
            "❌ GET Enquiries Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "Unable to fetch enquiries.",

            error:
                error.message

        });

    }

});




/*==== GET SINGLE ENQUIRY - GET /api/enquiries/:id ====*/
app.get("/api/enquiries/:id", async (req, res) => {

    try {

        const id = req.params.id;


        if (!id || isNaN(id)) {

            return res.status(400).json({

                success: false,
                message: "Invalid enquiry ID."

            });

        }


        const [rows] = await db.query(

            `
            SELECT
                id, student_name, mobile, email, gender, date_of_birth, course_interested, enquiry_source,
                counsellor, enquiry_date, follow_up_date, follow_up_time, status, address, comments,created_at,
                updated_at

            FROM student_enquiries

            WHERE id = ?
            `,

            [id]

        );


        if (rows.length === 0) {

            return res.status(404).json({

                success: false,
                message: "Enquiry not found."

            });

        }


        res.json({

            success: true,

            enquiry: rows[0]

        });


    } catch (error) {

        console.error(
            "❌ GET Single Enquiry Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "Unable to fetch enquiry.",

            error: error.message

        });

    }

});




/*==== UPDATE ENQUIRY - PUT /api/enquiries/:id ====*/
app.put("/api/enquiries/:id", async (req, res) => {

    try {

        const id = req.params.id;


        if (!id || isNaN(id)) {

            return res.status(400).json({

                success: false,
                message: "Invalid enquiry ID."

            });

        }


        const {

            studentName, mobile, email, gender, dateOfBirth, courseInterested, enquirySource, counsellor,
            enquiryDate, followUpDate, followUpTime, status, address, comments

        } = req.body;


        /*-- VALIDATION --*/
        if (
            !studentName ||
            !studentName.trim()
        ) {

            return res.status(400).json({

                success: false,
                message: "Student name is required."

            });

        }


        if (
            !mobile ||
            !mobile.trim()
        ) {

            return res.status(400).json({

                success: false,
                message: "Mobile number is required."

            });

        }


        if (!courseInterested) {

            return res.status(400).json({

                success: false,
                message: "Course is required."

            });

        }


        /*-- UPDATE --*/ 
        const [result] = await db.query(

            `
            UPDATE student_enquiries

            SET

                student_name = ?, mobile = ?, email = ?, gender = ?, date_of_birth = ?, course_interested = ?, enquiry_source = ?,
                counsellor = ?, enquiry_date = ?, follow_up_date = ?, follow_up_time = ?, status = ?, address = ?, comments = ?

            WHERE id = ?
            `,

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
                comments || null,
                id

            ]

        );


        if (result.affectedRows === 0) {

            return res.status(404).json({

                success: false,
                message: "Enquiry not found."

            });

        }


        console.log(
            `✅ Enquiry updated. ID: ${id}`
        );


        res.json({

            success: true,
            message: "✅ Enquiry updated successfully."

        });


    } catch (error) {

        console.error(
            "❌ UPDATE Enquiry Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "Unable to update enquiry.",

            error: error.message

        });

    }

});




/*==== DELETE ENQUIRY - DELETE /api/enquiries/:id ====*/
app.delete("/api/enquiries/:id", async (req, res) => {

    try {

        const id = req.params.id;


        if (!id || isNaN(id)) {

            return res.status(400).json({

                success: false,
                message: "Invalid enquiry ID."

            });

        }


        const [result] = await db.query(

            `
            DELETE FROM student_enquiries
            WHERE id = ?
            `,

            [id]

        );


        if (result.affectedRows === 0) {

            return res.status(404).json({

                success: false,
                message: "Enquiry not found."

            });

        }


        console.log(
            `✅ Enquiry deleted. ID: ${id}`
        );


        res.json({

            success: true,
            message: "Enquiry deleted successfully."

        });


    } catch (error) {

        console.error(
            "❌ DELETE Enquiry Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "Unable to delete enquiry.",

            error: error.message

        });

    }

});




/*==== ADD FOLLOW-UP - POST /api/follow-ups ====*/
app.post("/api/follow-ups", async (req, res) => {

    try {

        const {
            enquiry_id, follow_up_date, follow_up_time, follow_up_type, status,
            next_follow_up_date, next_follow_up_time, comments
        } = req.body;


        /*--- VALIDATE ENQUIRY ---*/
        if (
            !enquiry_id ||
            isNaN(enquiry_id)
        ) {

            return res.status(400).json({

                success: false,
                message: "Please select a student enquiry."

            });

        }


        /*--- GET ENQUIRY ---*/
        const [enquiryRows] = await db.query(

            `
            SELECT
                id,
                student_name, mobile, course_interested, counsellor

            FROM student_enquiries
            WHERE id = ?
            `,

            [enquiry_id]

        );


        if (enquiryRows.length === 0) {

            return res.status(404).json({

                success: false,
                message: "Selected student enquiry was not found."

            });

        }


        const enquiry = enquiryRows[0];

        /*--- VALIDATE FOLLOW-UP DATE ---*/
        if (!follow_up_date) {

            return res.status(400).json({

                success: false,
                message: "Please select follow-up date."

            });

        }


        /*--- VALIDATE TYPE ---*/
        const allowedTypes = [

            "Phone Call", "WhatsApp", "Email", "Walk-in"

        ];


        if (
            !allowedTypes.includes(
                follow_up_type
            )
        ) {

            return res.status(400).json({

                success: false,
                message: "Please select a valid follow-up type."

            });

        }


        /*--- VALIDATE STATUS ---*/
        const allowedStatuses = [

            "Interested", "Not Interested", "Call Back", "Admission Confirmed"

        ];


        if (
            !allowedStatuses.includes(
                status
            )
        ) {

            return res.status(400).json({

                success: false,
                message: "Please select a valid status."

            });

        }


        /*--- INSERT FOLLOW-UP ---*/
        const [result] = await db.query(

            `
            INSERT INTO follow_ups
            (
                enquiry_id, student_name, mobile_number, course, counsellor, follow_up_date, follow_up_time,
                follow_up_type, status, next_follow_up_date, next_follow_up_time, comments
            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,

            [

                enquiry.id,
                enquiry.student_name,
                enquiry.mobile,
                enquiry.course_interested,
                enquiry.counsellor || null,
                follow_up_date,
                follow_up_time || null,
                follow_up_type,
                status,
                next_follow_up_date || null,
                next_follow_up_time || null,
                comments || null

            ]

        );


        /*--- UPDATE ENQUIRY ---*/
        let enquiryStatus = status;


        /*
         * Your student_enquiries table
         * uses "Follow-up", not "Call Back".
         */

        if (
            status === "Call Back"
        ) {

            enquiryStatus = "Follow-up";

        }


        /*
         * If another follow-up is scheduled,
         * update enquiry's next follow-up date/time.
         */

        await db.query(

            `
            UPDATE student_enquiries

            SET
                status = ?,
                follow_up_date = ?,
                follow_up_time = ?

            WHERE id = ?
            `,

            [

                enquiryStatus,

                next_follow_up_date ||
                    follow_up_date,

                next_follow_up_time ||
                    follow_up_time ||
                    null,

                enquiry_id

            ]

        );


        /*--- SUCCESS ---*/
        console.log(
            `✅ Follow-up added. ID: ${result.insertId}`
        );


        res.status(201).json({

            success: true,
            message: "✅ Follow-up saved successfully.",

            followUpId: result.insertId

        });


    } catch (error) {

        console.error(
            "❌ Add Follow-up Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "❌ Unable to save follow-up.",

            error: error.message

        });

    }

});












/*-- Start server --*/
app.listen(PORT, () => {

    console.log(`CRM Server running on http://localhost:${PORT}`);

});