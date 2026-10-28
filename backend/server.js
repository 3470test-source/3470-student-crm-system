const express = require("express");
const cors = require("cors");
require("dotenv").config();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("./db");

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

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





/*==== LOGIN - ADMIN + COUNSELLOR + STAFF ====*/
app.post("/api/auth/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        /*--- VALIDATION ---*/
        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });

        }


        /*--- FIND USER ---*/
        const [users] = await db.execute(`
            SELECT
                id, full_name, email, mobile, username, password, role, status, department, joining_date, address
            FROM add_users
            WHERE email = ?
            LIMIT 1
        `, [email]);


        if (users.length === 0) {

            return res.status(401).json({
                success: false,
                message: "⚠️ Invalid email or password. Please check your credentials and try again."
            });

        }


        const user = users[0];


        /*--- CHECK ACCOUNT STATUS ---*/
        if (user.status !== "Active") {

            return res.status(403).json({
                success: false,
                message: "Your account is inactive. Please contact the administrator."
            });

        }


        /*--- CHECK PASSWORD ---*/
        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );


        if (!passwordMatch) {

            return res.status(401).json({
                success: false,
                message: "❌ Invalid email or password."
            });

        }


        /*--- CREATE JWT ---*/
        const token = jwt.sign(

            {
                id: user.id,
                email: user.email,
                role: user.role,
                full_name: user.full_name
            },

            process.env.JWT_SECRET || "temporary-secret",

            {
                expiresIn: "8h"
            }

        );


        /*--- REMOVE PASSWORD ---*/
        delete user.password;


        /*--- LOGIN RESPONSE ---*/
        res.json({

            success: true,
            message: "Login successful.",
            token: token,
            user: user

        });


    } catch (error) {

        console.error("❌ Login Error:", error);

        res.status(500).json({

            success: false,
            message: "Server error during login.",
            error: error.message

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
                message: "⚠️ Please enter the course name."

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
            message: "❌ Unable to fetch courses."

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
            error: error.message

        });

    }

});





/*==== GET ENQUIRY REPORT FILTER OPTIONS - Courses + Counsellors ====*/
app.get("/api/enquiries/report-options", async (req, res) => {
    try {

        /*--- LOAD ACTIVE COURSES ---*/
        const [courses] = await db.execute(`
            SELECT
                id,
                course_name,
                course_category,
                status
            FROM courses
            WHERE status = 'Active'
            ORDER BY course_name ASC
        `);


        /*--- LOAD ACTIVE COUNSELLORS FROM add_users ---*/
        const [counsellors] = await db.execute(`
            SELECT
                id,
                full_name AS name
            FROM add_users
            WHERE role = 'Counsellor'
              AND status = 'Active'
            ORDER BY full_name ASC
        `);


        res.json({
            success: true,
            courses,
            counsellors
        });


    } catch (error) {

        console.error(
            "❌ Enquiry Report Options Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to load enquiry report options.",
            error: error.message
        });

    }
});





/*==== GET DYNAMIC ENQUIRY REPORT ====*/
app.get("/api/enquiries/reports", async (req, res) => {

    try {

        const {
            from_date, to_date, course, counsellor, status
        } = req.query;


        /*--- BUILD WHERE CONDITION ---*/
        const conditions = [];
        const params = [];


        /*--- FROM DATE ---*/
        if (from_date) {

            conditions.push(`DATE(se.enquiry_date) >= ?`);
            params.push(from_date);

        }


        /*--- TO DATE ---*/
        if (to_date) {

            conditions.push(`DATE(se.enquiry_date) <= ?`);
            params.push(to_date);

        }


        /*--- COURSE ---*/
        if (course) {

            conditions.push(`se.course_interested = ?`);
            params.push(course);

        }


        /*--- COUNSELLOR ---*/
        if (counsellor) {

            conditions.push(`se.counsellor = ?`);
            params.push(counsellor);

        }


        /*--- STATUS ---*/
        if (status) {

            conditions.push(`se.status = ?`);
            params.push(status);

        }


        let whereClause = "";

        if (conditions.length > 0) {

            whereClause = `WHERE ${conditions.join(" AND ")}`;

        }


        /*--- GET ENQUIRY RECORDS ---*/
        const [enquiries] = await db.execute(
            `
            SELECT
                se.id, se.student_name, se.mobile, se.email, se.gender, se.date_of_birth, se.course_interested AS course,
                se.enquiry_source, se.counsellor, se.enquiry_date, se.follow_up_date, se.follow_up_time, se.status,
                se.address, se.comments, se.created_at, se.updated_at
            FROM student_enquiries se

            ${whereClause}

            ORDER BY se.enquiry_date DESC, se.id DESC
            `,
            params
        );


        /*--- SUMMARY COUNTS ---*/
        const [summaryRows] = await db.execute(
            `
            SELECT

                COUNT(*) AS total_enquiries,

                SUM(
                    CASE
                        WHEN se.status = 'Interested'
                        THEN 1
                        ELSE 0
                    END
                ) AS interested,

                SUM(
                    CASE
                        WHEN se.status = 'Follow-up'
                        THEN 1
                        ELSE 0
                    END
                ) AS follow_ups,

                SUM(
                    CASE
                        WHEN se.status = 'Admission Confirmed'
                        THEN 1
                        ELSE 0
                    END
                ) AS converted,

                SUM(
                    CASE
                        WHEN se.status = 'Not Interested'
                        THEN 1
                        ELSE 0
                    END
                ) AS not_interested

            FROM student_enquiries se

            ${whereClause}
            `,
            params
        );


        /*--- STATUS SUMMARY ---*/
        const [statusRows] = await db.execute(
            `
            SELECT
                se.status,
                COUNT(*) AS total
            FROM student_enquiries se

            ${whereClause}

            GROUP BY se.status
            ORDER BY total DESC
            `,
            params
        );

        const summary = summaryRows[0] || {};


        /*--- NORMALIZE SUMMARY VALUES ---*/
        const finalSummary = {

            total_enquiries: Number(summary.total_enquiries) || 0,

            interested: Number(summary.interested) || 0,

            follow_ups: Number(summary.follow_ups) || 0,

            converted: Number(summary.converted) || 0,

            not_interested: Number(summary.not_interested) || 0

        };


        /*--- RESPONSE ---*/
        res.json({

            success: true,
            summary: finalSummary,
            status_summary: statusRows,
            enquiries

        });


    } catch (error) {

        console.error("❌ Enquiry Report Error:", error);

        res.status(500).json({

            success: false,
            message: "Failed to load enquiry report.",
            error: error.message

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





/*==== GET /api/follow-ups/today ====*/
app.get("/api/follow-ups/today", async (req, res) => {

        try {

            /*--- GET QUERY PARAMETERS ---*/
            const search = typeof req.query.search === "string"
                    ? req.query.search.trim()
                    : "";

            const counsellor = typeof req.query.counsellor === "string"
                    ? req.query.counsellor.trim()
                    : "";

            const status = typeof req.query.status === "string"
                    ? req.query.status.trim()
                    : "";


            /*--- SQL - student_enquiries is the correct table name ---*/
            let sql = `

                SELECT
                    f.id, f.enquiry_id, e.student_name, e.mobile, e.course_interested, f.follow_up_date,
                    f.follow_up_time, f.follow_up_type, f.status, e.counsellor, f.next_follow_up_date,
                    f.next_follow_up_time, f.comments

                FROM follow_ups AS f

                INNER JOIN student_enquiries AS e
                    ON f.enquiry_id = e.id

                WHERE f.follow_up_date = CURDATE()

            `;


            const params = [];

            /*--- SEARCH - Student Name OR Mobile ---*/
            
            if (search !== "") {

                sql += `

                    AND (

                        e.student_name LIKE ?
                        OR e.mobile LIKE ?

                    )

                `;

                const searchValue = `%${search}%`;

                params.push(searchValue);
                params.push(searchValue);

            }


            /*--- COUNSELLOR FILTER ---*/
            if (counsellor !== "") {

                sql += `AND e.counsellor = ?`;

                params.push(counsellor);

            }


            /*--- STATUS FILTER ---*/
            if (status !== "") {

                sql += `AND f.status = ?`;

                params.push(status);

            }


            /*--- ORDER ---*/
            sql += `

                ORDER BY

                    f.follow_up_time ASC,
                    f.id ASC

            `;


            /*--- DEBUG ---*/
            console.log(
                "Today's Follow-up SQL:",
                sql
            );

            console.log(
                "Today's Follow-up Params:",
                params
            );


            /*--- EXECUTE QUERY ---*/
            const [rows] = await db.execute(
                    sql,
                    params
                );


            /*--- RESPONSE ---*/
            res.status(200).json({

                success: true,
                count: rows.length,
                followUps: rows,

                /*-- Compatibility --*/
                data: rows

            });

        } catch (error) {

            console.error(
                "===================================="
            );

            console.error(
                "TODAY FOLLOW-UP ERROR"
            );

            console.error(
                error
            );

            console.error(
                "===================================="
            );


            res.status(500).json({

                success: false,
                message: "Unable to load today's follow-ups.",
                error: error.message

            });

        }

    }
);





/*==== GET /api/follow-ups/scheduled ====*/
app.get("/api/follow-ups/scheduled", async (req, res) => {

    try {

        /*--- GET FILTER VALUES ---*/
        const search = typeof req.query.search === "string"
                ? req.query.search.trim()
                : "";

        const date = typeof req.query.date === "string"
                ? req.query.date.trim()
                : "";

        const counsellor = typeof req.query.counsellor === "string"
                ? req.query.counsellor.trim()
                : "";

        const status = typeof req.query.status === "string"
                ? req.query.status.trim()
                : "";


        /*--- BASE SQL ---*/
        let sql = `

            SELECT

                f.id, f.enquiry_id, e.student_name, e.mobile, e.course_interested,
                f.follow_up_date, f.follow_up_time, f.follow_up_type, f.status,
                e.counsellor, f.next_follow_up_date, f.next_follow_up_time,
                f.comments

            FROM follow_ups AS f

            INNER JOIN student_enquiries AS e
                ON f.enquiry_id = e.id

            WHERE 1 = 1

        `;


        const params = [];

        /*--- DATE ---*/
        if (date !== "") {

            sql += `AND f.follow_up_date = ?`;

            params.push(date);

        } else {

            /*
             * No date selected:
             * show future scheduled follow-ups only.
             */

            sql += `AND f.follow_up_date > CURDATE()`;

        }


        /*--- SEARCH ---*/
        if (search !== "") {

            sql += `

                AND (
                    e.student_name LIKE ?
                    OR e.mobile LIKE ?
                )

            `;

            const searchValue = `%${search}%`;

            params.push(searchValue);
            params.push(searchValue);

        }


        /*--- COUNSELLOR ---*/
        if (counsellor !== "") {

            sql += `AND e.counsellor = ?`;

            params.push(counsellor);

        }


        /*--- STATUS ---*/
        if (status !== "") {

            sql += `AND f.status = ?`;

            params.push(status);

        }


        /*--- ORDER ---*/
        sql += `

            ORDER BY

                f.follow_up_date ASC,
                f.follow_up_time ASC,
                f.id ASC

        `;


        /*--- DEBUG ---*/
        console.log(
            "Scheduled Follow-up SQL:",
            sql
        );

        console.log(
            "Scheduled Follow-up Params:",
            params
        );


        /*--- DATABASE ---*/
        const [rows] = await db.execute(
                sql,
                params
            );


        /*--- SUCCESS ---*/
        console.log(`✅ Scheduled Follow-ups fetched: ${rows.length}`);

        res.status(200).json({

            success: true,
            count: rows.length,
            followUps: rows,
            data: rows

        });

    }

    catch (error) {

        console.error(
            "❌ Scheduled Follow-ups Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "Unable to load scheduled follow-ups.",
            error: error.message

        });

    }

});





/*==== UPCOMING FOLLOW-UPS ====*/
app.get("/api/follow-ups/upcoming", async (req, res) => {

    try {

        const {
            search = "", course = "", counsellor = "", date = ""
        } = req.query;


        /*--- BUILD FILTER CONDITIONS ---*/
        const conditions = [
            `
            DATE(f.follow_up_date) > CURDATE()
            `,
            `
            f.status NOT IN ('Completed', 'Not Interested')
            `
        ];

        const params = [];

        
        /*--- SEARCH ---*/
        if (search.trim() !== "") {

            conditions.push(`
                (
                    f.student_name LIKE ?
                    OR f.mobile_number LIKE ?
                )
            `);

            const searchValue = `%${search.trim()}%`;

            params.push(
                searchValue,
                searchValue
            );

        }


        /*--- COURSE ---*/
        if (course.trim() !== "") {

            conditions.push(`
                f.course = ?
            `);

            params.push(course.trim());

        }


        /*--- COUNSELLOR ---*/
        if (counsellor.trim() !== "") {

            conditions.push(`f.counsellor = ?`);

            params.push(counsellor.trim());

        }


        /*--- SPECIFIC DATE ---*/
        if (date.trim() !== "") {

            conditions.push(`DATE(f.follow_up_date) = ?`);

            params.push(date.trim());

        }


        const whereClause = `WHERE ${conditions.join(" AND ")}`;

 
        /*--- GET UPCOMING FOLLOW-UPS ---*/
        const [followUps] = await db.execute(
            `
            SELECT
                f.id, f.enquiry_id, f.student_name, f.mobile_number, f.course, f.counsellor, f.follow_up_date, f.follow_up_time,
                f.follow_up_type, f.status, f.next_follow_up_date, f.next_follow_up_time, f.comments, f.created_at, f.updated_at

            FROM follow_ups f

            ${whereClause}

            ORDER BY
                f.follow_up_date ASC,
                f.follow_up_time ASC,
                f.id ASC
            `,
            params
        );


        /*--- SUMMARY ---*/
        const summaryParams = [...params];

        const [summaryRows] = await db.execute(
            `
            SELECT

                COUNT(*) AS total_upcoming,

                SUM(
                    CASE
                        WHEN DATE(f.follow_up_date)
                            = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                        THEN 1
                        ELSE 0
                    END
                ) AS tomorrow,

                SUM(
                    CASE
                        WHEN DATE(f.follow_up_date)
                            >= DATE_ADD(
                                CURDATE(),
                                INTERVAL -WEEKDAY(CURDATE()) DAY
                            )
                        AND DATE(f.follow_up_date)
                            < DATE_ADD(
                                CURDATE(),
                                INTERVAL 7 - WEEKDAY(CURDATE()) DAY
                            )
                        THEN 1
                        ELSE 0
                    END
                ) AS this_week,

                COUNT(
                    DISTINCT NULLIF(
                        TRIM(f.counsellor),
                        ''
                    )
                ) AS counsellors

            FROM follow_ups f

            ${whereClause}
            `,
            summaryParams
        );

        const summary = summaryRows[0] || {};


        /*--- RESPONSE ---*/
        res.json({

            success: true,
            summary: {

                total_upcoming: Number(summary.total_upcoming) || 0,
                tomorrow: Number(summary.tomorrow) || 0,
                this_week: Number(summary.this_week) || 0,
                counsellors: Number(summary.counsellors) || 0

            },

            followUps

        });


    } catch (error) {

        console.error(
            "❌ Upcoming Follow-ups Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "Failed to load upcoming follow-ups.",
            error: error.message

        });

    }

});





/*==== UPCOMING FOLLOW-UP FILTER OPTIONS  ====*/
app.get("/api/follow-ups/upcoming/options", async (req, res) => {

    try {

        /*--- COURSES ---*/
        const [courses] = await db.execute(`
            SELECT DISTINCT
                TRIM(course) AS course
            FROM follow_ups
            WHERE course IS NOT NULL
              AND TRIM(course) <> ''
            ORDER BY course ASC
        `);

 
        /*--- COUNSELLORS ---*/
        const [counsellors] = await db.execute(`
            SELECT DISTINCT
                TRIM(counsellor) AS name
            FROM follow_ups
            WHERE counsellor IS NOT NULL
              AND TRIM(counsellor) <> ''
            ORDER BY name ASC
        `);


        res.json({

            success: true,
            courses,
            counsellors

        });


    } catch (error) {

        console.error(
            "❌ Upcoming Filter Options Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "Failed to load filter options.",
            error: error.message

        });

    }

});





/*==== MISSED FOLLOW-UPS ====*/
app.get("/api/follow-ups/missed", async (req, res) => {
    try {

        const {
            search,
            course,
            counsellor,
            date
        } = req.query;

        const conditions = [];
        const params = [];

        /*
         * A follow-up is considered MISSED when:
         *
         * 1. Follow-up date is before today
         * OR
         * 2. Follow-up is today and the scheduled time has already passed
         *
         * Completed and Not Interested follow-ups are excluded.
         */

        conditions.push(`
            (
                DATE(f.follow_up_date) < CURDATE()
                OR
                (
                    DATE(f.follow_up_date) = CURDATE()
                    AND f.follow_up_time IS NOT NULL
                    AND f.follow_up_time < CURTIME()
                )
            )
        `);

        conditions.push(`
            f.status NOT IN ('Completed', 'Not Interested')
        `);

        /*-- Search Student Name / Mobile --*/
        if (search) {

            conditions.push(`
                (
                    f.student_name LIKE ?
                    OR f.mobile_number LIKE ?
                )
            `);

            params.push(`%${search}%`);
            params.push(`%${search}%`);
        }

        /*-- Course filter --*/
        if (course) {

            conditions.push(`f.course = ?`);
            params.push(course);
        }

        /*-- Counsellor filter --*/
        if (counsellor) {

            conditions.push(`f.counsellor = ?`);
            params.push(counsellor);
        }

        /*-- Specific date filter --*/
        if (date) {

            conditions.push(`DATE(f.follow_up_date) = ?`);
            params.push(date);
        }

        const whereClause = `
            WHERE ${conditions.join(" AND ")}
        `;


        /*--- MISSED FOLLOW-UP LIST ---*/
        const [followUps] = await db.execute(
            `
            SELECT
                f.id, f.enquiry_id, f.student_name, f.mobile_number, f.course, f.counsellor, f.follow_up_date,
                f.follow_up_time, f.follow_up_type, f.status, f.next_follow_up_date, f.next_follow_up_time,
                f.comments, f.created_at, f.updated_at
            FROM follow_ups f
            ${whereClause}
            ORDER BY
                f.follow_up_date DESC,
                f.follow_up_time DESC,
                f.id DESC
            `,
            params
        );


        /*--- SUMMARY ---*/
        const summaryParams = [...params];

        const [summaryRows] = await db.execute(
            `
            SELECT

                COUNT(*) AS total_missed,

                SUM(
                    CASE
                        WHEN DATE(f.follow_up_date) = CURDATE()
                        THEN 1
                        ELSE 0
                    END
                ) AS today_missed,

                SUM(
                    CASE
                        WHEN DATE(f.follow_up_date)
                             >= DATE_ADD(
                                    CURDATE(),
                                    INTERVAL -WEEKDAY(CURDATE()) DAY
                                )
                         AND DATE(f.follow_up_date)
                             < DATE_ADD(
                                    CURDATE(),
                                    INTERVAL 7 - WEEKDAY(CURDATE()) DAY
                                )
                        THEN 1
                        ELSE 0
                    END
                ) AS this_week_missed,

                COUNT(
                    DISTINCT
                    CASE
                        WHEN f.counsellor IS NOT NULL
                             AND TRIM(f.counsellor) <> ''
                        THEN TRIM(f.counsellor)
                    END
                ) AS counsellors

            FROM follow_ups f

            ${whereClause}
            `,
            summaryParams
        );


        const summary = summaryRows[0] || {};

        res.json({
            success: true,

            summary: {
                total_missed: Number(summary.total_missed) || 0,
                today_missed: Number(summary.today_missed) || 0,
                this_week_missed: Number(summary.this_week_missed) || 0,
                counsellors: Number(summary.counsellors) || 0
            },

            followUps

        });

    } catch (error) {

        console.error("❌ Missed Follow-ups Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load missed follow-ups.",
            error: error.message
        });

    }
});





/*==== MISSED FOLLOW-UP FILTER OPTIONS ====*/
app.get("/api/follow-ups/missed/options", async (req, res) => {

    try {

        const [courses] = await db.execute(`
            SELECT DISTINCT
                TRIM(course) AS name
            FROM follow_ups
            WHERE course IS NOT NULL
              AND TRIM(course) <> ''
            ORDER BY name ASC
        `);


        const [counsellors] = await db.execute(`
            SELECT DISTINCT
                TRIM(counsellor) AS name
            FROM follow_ups
            WHERE counsellor IS NOT NULL
              AND TRIM(counsellor) <> ''
            ORDER BY name ASC
        `);


        res.json({

            success: true,
            courses,
            counsellors

        });

    } catch (error) {

        console.error(
            "❌ Missed Follow-up Options Error:",
            error
        );

        res.status(500).json({

            success: false,
            message: "Failed to load filter options.",
            error: error.message

        });

    }

});





/*==== GET FOLLOW-UP HISTORY ====*/
app.get("/api/follow-ups/history", async (req, res) => {

    try {

        const search = typeof req.query.search === "string"
            ? req.query.search.trim()
            : "";

        const fromDate = typeof req.query.fromDate === "string"
            ? req.query.fromDate.trim()
            : "";

        const toDate = typeof req.query.toDate === "string"
            ? req.query.toDate.trim()
            : "";

        const counsellor = typeof req.query.counsellor === "string"
            ? req.query.counsellor.trim()
            : "";

        const status = typeof req.query.status === "string"
            ? req.query.status.trim()
            : "";

        let sql = `
            SELECT
                f.id, f.enquiry_id, e.student_name, e.mobile, e.course_interested, f.follow_up_date, f.follow_up_time,
                f.follow_up_type, f.status, e.counsellor, f.comments, f.next_follow_up_date, f.next_follow_up_time, f.created_at,
                f.updated_at
            FROM follow_ups f
            INNER JOIN student_enquiries e
                ON f.enquiry_id = e.id
            WHERE 1 = 1
        `;

        const params = [];

        
        /*--- Search student / mobile ---*/
        if (search !== "") {

            sql += `
                AND (
                    e.student_name LIKE ?
                    OR e.mobile LIKE ?
                )
            `;

            const searchValue = `%${search}%`;

            params.push(searchValue);
            params.push(searchValue);
        }

        
        /*--- From date ---*/
        if (fromDate !== "") {

            sql += `AND f.follow_up_date >= ?`;

            params.push(fromDate);
        }

        
        /*--- To date ---*/
        if (toDate !== "") {

            sql += `AND f.follow_up_date <= ?`;

            params.push(toDate);
        }

        
        /*--- Counsellor ---*/
        if (counsellor !== "") {

            sql += `AND e.counsellor = ?`;

            params.push(counsellor);
        }

        
        /*--- Status / Result ---*/
        if (status !== "") {

            sql += `AND f.status = ?`;

            params.push(status);
        }

        
        /*--- History order ---*/
        sql += `
            ORDER BY
                f.follow_up_date DESC, f.follow_up_time DESC, f.id DESC
        `;

        console.log("Follow-up History SQL:", sql);
        console.log("Follow-up History Params:", params);

        const [rows] = await db.execute(sql, params);

        console.log(
            "Follow-up History Records:",
            rows.length
        );

        res.status(200).json({
            success: true,
            count: rows.length,
            followUps: rows,
            data: rows
        });

    } catch (error) {

        console.error(
            "Follow-up History Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to load follow-up history.",
            error: error.message
        });
    }
});





/*==== GET SINGLE FOLLOW-UP - GET /api/follow-ups/:id ====*/
app.get("/api/follow-ups/:id", async (req, res) => {

        try {

            const id = Number(req.params.id);

            /*--- VALIDATE ID ---*/
            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    success: false,
                    message: "Invalid follow-up ID."

                });

            }


            /*--- GET FOLLOW-UP ---*/
            const [rows] = await db.execute(`

                    SELECT
                        f.id, f.enquiry_id, e.student_name, e.mobile, e.course_interested, e.counsellor, f.follow_up_date,
                        f.follow_up_time, f.follow_up_type, f.status, f.next_follow_up_date, f.next_follow_up_time,
                        f.comments

                    FROM follow_ups AS f

                    INNER JOIN student_enquiries AS e
                        ON f.enquiry_id = e.id

                    WHERE f.id = ?

                    LIMIT 1

                `, [id]);


            /*--- NOT FOUND ---*/
            if (rows.length === 0) {

                return res.status(404).json({

                    success: false,
                    message: "Follow-up not found."

                });

            }


            /*--- SUCCESS ---*/
            res.status(200).json({

                success: true,
                followUp: rows[0]

            });

        } catch (error) {

            console.error(
                "Get Follow-up Error:",
                error
            );


            res.status(500).json({

                success: false,
                message: "Unable to load follow-up.",
                error: error.message

            });

        }

    }
);





/*==== COMPLETE FOLLOW-UP - PUT /api/follow-ups/:id/complete ====*/
app.put("/api/follow-ups/:id/complete", async (req, res) => {

        try {

            const id = Number(req.params.id);

            /*--- VALIDATE ID ---*/
            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    success: false,
                    message: "Invalid follow-up ID."

                });

            }


            /*--- CHECK FOLLOW-UP EXISTS ---*/
            const [existingRows] = await db.execute(`

                    SELECT id, status
                    FROM follow_ups
                    WHERE id = ?
                    LIMIT 1

                `, [id]);


            if (existingRows.length === 0) {

                return res.status(404).json({

                    success: false,
                    message: "Follow-up not found."

                });

            }


            /*--- UPDATE STATUS ---*/
            await db.execute(`

                UPDATE follow_ups
                SET status = 'Completed'

                WHERE id = ?

            `, [id]);


            /*--- SUCCESS ---*/
            res.status(200).json({

                success: true,
                message: "✅ Follow-up marked as completed."

            });

        } catch (error) {

            console.error(
                "Complete Follow-up Error:",
                error
            );


            res.status(500).json({

                success: false,
                message: "Unable to complete follow-up.",

                error: error.message

            });

        }

    }
);





/*==== UPDATE FOLLOW-UP - PUT /api/follow-ups/:id ====*/
app.put("/api/follow-ups/:id", async (req, res) => {

        try {

            const id = Number(req.params.id);

            /*--- VALIDATE ID ---*/
            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    success: false,
                    message: "Invalid follow-up ID."

                });

            }


            /*--- GET BODY ---*/
            const {

                follow_up_date, follow_up_time, follow_up_type, status, next_follow_up_date,
                next_follow_up_time, comments

            } = req.body;


            /*--- VALIDATION ---*/
            if (!follow_up_date) {

                return res.status(400).json({

                    success: false,
                    message: "Follow-up date is required."

                });

            }


            if (!follow_up_type) {

                return res.status(400).json({

                    success: false,
                    message: "Follow-up type is required."

                });

            }


            if (!status) {

                return res.status(400).json({

                    success: false,
                    message: "Status is required."

                });

            }


            /*--- CHECK EXISTS ---*/
            const [existingRows] = await db.execute(`

                    SELECT id
                    FROM follow_ups
                    WHERE id = ?
                    LIMIT 1

                `, [id]);


            if (existingRows.length === 0) {

                return res.status(404).json({

                    success: false,
                    message: "Follow-up not found."

                });

            }


            /*--- UPDATE ---*/
            await db.execute(`

                UPDATE follow_ups

                SET
                    follow_up_date = ?, follow_up_time = ?, follow_up_type = ?, status = ?,
                    next_follow_up_date = ?, next_follow_up_time = ?, comments = ?
                    
                WHERE id = ?

            `, [

                follow_up_date,
                follow_up_time || null,
                follow_up_type,
                status,
                next_follow_up_date || null,
                next_follow_up_time || null,
                comments || null,
                id

            ]);


            /*--- SUCCESS ---*/
            res.status(200).json({

                success: true,
                message: "✅ Follow-up updated successfully."

            });

        } catch (error) {

            console.error(
                "Update Follow-up Error:",
                error
            );


            res.status(500).json({

                success: false,
                message: "Unable to update follow-up.",

                error: error.message

            });

        }

    }
);





/*==== NOTIFICATION HELPER FUNCTIONS ====*/
function formatDateForJS(value) {

    if (!value) {
        return "";
    }

    if (value instanceof Date) {

        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    if (typeof value === "string") {
        return value.substring(0, 10);
    }

    return String(value);
}


function formatTimeForNotification(value) {

    if (!value) {
        return "";
    }

    const timeString = String(value);
    const parts = timeString.split(":");

    if (parts.length < 2) {
        return timeString;
    }

    let hour = Number(parts[0]);
    const minute = String(parts[1]).padStart(2, "0");

    if (Number.isNaN(hour)) {
        return timeString;
    }

    const ampm = hour >= 12 ? "PM" : "AM";

    hour = hour % 12;

    if (hour === 0) {
        hour = 12;
    }

    return `${String(hour).padStart(2, "0")}:${minute} ${ampm}`;
}





/*==== TODAY'S NOTIFICATIONS API ====*/
app.get("/api/notifications/today", async (req, res) => {
    try {

        
        /*--- 1. TODAY'S NEW ENQUIRIES ---*/
        const [newEnquiries] = await db.execute(`
            SELECT
                id, student_name, course_interested, counsellor, enquiry_date, created_at
            FROM student_enquiries
            WHERE DATE(enquiry_date) = CURDATE()
            ORDER BY created_at DESC, id DESC
        `);


        /*--- 2. TODAY'S FOLLOW-UPS ---*/
        const [todayFollowUps] = await db.execute(`
            SELECT
                id, enquiry_id, student_name, mobile_number, course, counsellor, follow_up_date,
                follow_up_time, follow_up_type, status, next_follow_up_date, comments, created_at
            FROM follow_ups
            WHERE DATE(follow_up_date) = CURDATE()
            ORDER BY
                CASE
                    WHEN follow_up_time IS NULL THEN 1
                    ELSE 0
                END,
                follow_up_time ASC,
                id DESC
        `);


        /*--- 3. TODAY'S ADMISSIONS ---*/
        const [todayAdmissions] = await db.execute(`
            SELECT
                id, student_name, course, counsellor, joining_date, admission_status, created_at
            FROM admissions
            WHERE DATE(created_at) = CURDATE()
               OR DATE(joining_date) = CURDATE()
            ORDER BY created_at DESC, id DESC
        `);


        /*--- 4. MISSED FOLLOW-UPS ---*/
        const [missedFollowUps] = await db.execute(`
            SELECT
                id, student_name, course, counsellor, follow_up_date, follow_up_time,
                status
            FROM follow_ups
            WHERE
                (
                    DATE(follow_up_date) < CURDATE()
                    AND status NOT IN ('Completed', 'Not Interested')
                )
                OR
                (
                    DATE(follow_up_date) = CURDATE()
                    AND follow_up_time < CURTIME()
                    AND status NOT IN ('Completed', 'Not Interested')
                )
            ORDER BY follow_up_date ASC, follow_up_time ASC
        `);


        /*--- 5. BUILD NOTIFICATION LIST ---*/
        const notifications = [];


        /*--- New enquiries ---*/
        newEnquiries.forEach(enquiry => {

            notifications.push({
                id: `enquiry-${enquiry.id}`,
                type: "enquiry",
                title: "New Student Enquiry",
                message:
                    `${enquiry.student_name || "Student"} has submitted a new enquiry` +
                    `${enquiry.course_interested ? ` for the ${enquiry.course_interested} course.` : "."}`,
                time: enquiry.created_at || enquiry.enquiry_date,
                status: "New",
                icon: "fa-user-plus"
            });

        });


        /*--- Today's follow-ups ---*/
        todayFollowUps.forEach(followUp => {

            let status = "Pending";

            if (followUp.status === "Completed") {
                status = "Completed";
            } else if (followUp.status === "Not Interested") {
                status = "Not Interested";
            } else {

                const followUpDate = new Date(
                    `${formatDateForJS(followUp.follow_up_date)}T${followUp.follow_up_time || "23:59:59"}`
                );

                if (!isNaN(followUpDate.getTime()) && followUpDate < new Date()) {
                    status = "Attention";
                }
            }


            notifications.push({
                id: `followup-${followUp.id}`,
                type: "followup",
                title: "Follow-up Reminder",
                message:
                    `Follow-up with ${followUp.student_name || "Student"}` +
                    `${followUp.course ? ` regarding the ${followUp.course} course` : ""}` +
                    `${followUp.follow_up_time ? ` is scheduled for ${formatTimeForNotification(followUp.follow_up_time)}.` : "."}`,
                time: followUp.follow_up_time || followUp.follow_up_date,
                status: status,
                icon: "fa-phone"
            });

        });


        /*--- Today's admissions ---*/
        todayAdmissions.forEach(admission => {

            notifications.push({
                id: `admission-${admission.id}`,
                type: "admission",
                title: "New Admission",
                message:
                    `${admission.student_name || "Student"} has completed admission` +
                    `${admission.course ? ` for the ${admission.course} course.` : "."}`,
                time: admission.created_at || admission.joining_date,
                status: "Completed",
                icon: "fa-user-check"
            });

        });


        /*--- Missed follow-ups ---*/
        missedFollowUps.forEach(followUp => {

            notifications.push({
                id: `missed-${followUp.id}`,
                type: "alert",
                title: "Pending Follow-up",
                message:
                    `${followUp.student_name || "Student"} has a missed follow-up` +
                    `${followUp.course ? ` for the ${followUp.course} course.` : "."}`,
                time: followUp.follow_up_time || followUp.follow_up_date,
                status: "Attention",
                icon: "fa-circle-exclamation"
            });

        });


        /*--- SORT NOTIFICATIONS ---*/
        notifications.sort((a, b) => {

            const dateA = new Date(a.time);
            const dateB = new Date(b.time);

            return dateB - dateA;

        });


        /*--- SUMMARY ---*/
        const summary = {
            total_notifications: notifications.length,

            follow_ups_today: todayFollowUps.length,

            new_enquiries: newEnquiries.length,

            admissions: todayAdmissions.length,

            missed_follow_ups: missedFollowUps.length
        };


        /*--- RESPONSE ---*/
        res.json({
            success: true,
            summary,
            notifications
        });


    } catch (error) {

        console.error("❌ Today's Notifications Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load today's notifications.",
            error: error.message
        });

    }
});





/*==== GET ACTIVE COUNSELLORS ====*/
app.get("/api/admissions/counsellors", async (req, res) => {
    try {

        const [counsellors] = await db.execute(`
            SELECT
                id,
                full_name AS name
            FROM add_users
            WHERE role = 'Counsellor'
              AND status = 'Active'
            ORDER BY full_name ASC
        `);

        res.json({
            success: true,
            counsellors
        });

    } catch (error) {

        console.error(
            "❌ Admission Counsellors Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to load counsellors.",
            error: error.message
        });

    }
});





/*==== GET ACTIVE COURSES FOR ADMISSION ====*/
app.get("/api/admissions/courses", async (req, res) => {
  try {

    const [courses] = await db.execute(`
      SELECT
        id, course_name, course_category, course_fee,
        status
      FROM courses
      WHERE status = 'Active'
      ORDER BY course_name ASC
    `);

    res.json({
      success: true,
      courses: courses
    });

  } catch (error) {
    console.error("❌ Admission Courses Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load courses.",
      error: error.message
    });
  }
});





/*==== CREATE NEW ADMISSION ====*/
app.post("/api/admissions", async (req, res) => {
  try {

    const {
      student_name, mobile, email, gender, date_of_birth, course, batch,
      joining_date, course_fee, discount, final_fee, registration_amount,
      balance_amount, payment_mode, counsellor, admission_status, remarks
    } = req.body;

    /*--- Required fields ---*/
    if (!student_name || !mobile  || !course) {
      return res.status(400).json({
        success: false,
        message: "Student name, mobile number and course are required."
      });
    }

    
    /*--- FEE CALCULATION ---*/
    const courseFee = Number(course_fee) || 0;
    const discountAmount = Number(discount) || 0;
    const registrationAmount = Number(registration_amount) || 0;

    let finalFee = Number(final_fee);

    if (!final_fee || isNaN(finalFee)) {
      finalFee = courseFee - discountAmount;
    }

    if (finalFee < 0) {
      finalFee = 0;
    }

    let balanceAmount = Number(balance_amount);

    if (!balance_amount || isNaN(balanceAmount)) {
      balanceAmount = finalFee - registrationAmount;
    }

    if (balanceAmount < 0) {
      balanceAmount = 0;
    }


    /*--- INSERT ADMISSION ---*/
    const [result] = await db.execute(
      `
      INSERT INTO admissions (
        student_name, mobile, email, gender, date_of_birth, course, batch,
        joining_date, course_fee, discount, final_fee, registration_amount, balance_amount,
        payment_mode, counsellor, admission_status, remarks
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        student_name, mobile, email || null, gender || null, date_of_birth || null, course, batch || null,
        joining_date || null, courseFee, discountAmount, finalFee, registrationAmount, balanceAmount,
        payment_mode || null, counsellor || null, admission_status || "Pending", remarks || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Admission created successfully.",
      admissionId: result.insertId
    });

  } catch (error) {

    console.error("❌ Create Admission Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create admission.",
      error: error.message
    });
  }
});





/*==== GET ALL ADMISSIONS ====*/
app.get("/api/admissions", async (req, res) => {
    try {
        const [admissions] = await db.execute(`
            SELECT
                id, student_name, mobile, email, gender, date_of_birth, course, batch, joining_date, course_fee,
                discount, final_fee, registration_amount, balance_amount, payment_mode, counsellor, admission_status,
                documents, remarks, created_at, updated_at
            FROM admissions
            ORDER BY id DESC
        `);

        res.json({
            success: true,
            admissions
        });

    } catch (error) {
        console.error("❌ Get Admissions Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load admissions.",
            error: error.message
        });
    }
});





/*==== ADMISSION REPORT - COURSE FILTER OPTIONS ====*/
app.get("/api/admissions/report-courses", async (req, res) => {
    try {
        const [courses] = await db.execute(`
            SELECT DISTINCT course
            FROM admissions
            WHERE course IS NOT NULL
              AND TRIM(course) <> ''
            ORDER BY course ASC
        `);

        res.json({
            success: true,
            courses
        });

    } catch (error) {
        console.error("❌ Admission Report Courses Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load admission report courses.",
            error: error.message
        });
    }
});





/*==== ADMISSION REPORT - COUNSELLOR FILTER OPTIONS ====*/
app.get("/api/admissions/report-counsellors", async (req, res) => {
    try {
        const [counsellors] = await db.execute(`
            SELECT DISTINCT counsellor
            FROM admissions
            WHERE counsellor IS NOT NULL
              AND TRIM(counsellor) <> ''
            ORDER BY counsellor ASC
        `);

        res.json({
            success: true,
            counsellors
        });

    } catch (error) {
        console.error("❌ Admission Report Counsellors Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load admission report counsellors.",
            error: error.message
        });
    }
});





/*==== DYNAMIC ADMISSION REPORT ====*/
app.get("/api/admissions/reports", async (req, res) => {
    try {
        const {
            from_date, to_date, course, counsellor, payment_status
        } = req.query;

        const conditions = [];
        const params = [];

        
        /*--- DATE FILTER ---*/
        if (from_date) {
            conditions.push(`a.joining_date >= ?`);
            params.push(from_date);
        }

        if (to_date) {
            conditions.push(`
                a.joining_date < DATE_ADD(?, INTERVAL 1 DAY)
            `);
            params.push(to_date);
        }

        
        /*--- COURSE FILTER ---*/
        if (course) {
            conditions.push(`a.course = ?`);
            params.push(course);
        }

        
        /*--- COUNSELLOR FILTER ---*/
        if (counsellor) {
            conditions.push(`a.counsellor = ?`);
            params.push(counsellor);
        }

        
        /*--- PAYMENT STATUS ---*/
        const paymentStatusCase = `
            CASE
                WHEN COALESCE(a.balance_amount, 0) <= 0
                    THEN 'Paid'

                WHEN COALESCE(a.registration_amount, 0) > 0
                    AND COALESCE(a.balance_amount, 0) > 0
                    THEN 'Partial'

                ELSE 'Pending'
            END
        `;

        if (
            payment_status &&
            ["Paid", "Partial", "Pending"].includes(payment_status)
        ) {
            conditions.push(`${paymentStatusCase} = ?`);
            params.push(payment_status);
        }

        const whereClause = conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        
        /*--- REPORT RECORDS ---*/
        const [admissions] = await db.execute(
            `
            SELECT
                a.id, a.student_name, a.mobile, a.course, a.counsellor, a.joining_date AS admission_date,
                a.course_fee, a.final_fee, a.registration_amount AS paid_amount, a.balance_amount,

                ${paymentStatusCase} AS payment_status

            FROM admissions a

            ${whereClause}

            ORDER BY a.id DESC
            `,
            params
        );

        
        /*--- SUMMARY ---*/
        const [summaryRows] = await db.execute(
            `
            SELECT

                COUNT(*) AS total_admissions,

                SUM(
                    CASE
                        WHEN DATE(a.joining_date) = CURDATE()
                        THEN 1
                        ELSE 0
                    END
                ) AS today_admissions,

                SUM(
                    CASE
                        WHEN YEAR(a.joining_date) = YEAR(CURDATE())
                        AND MONTH(a.joining_date) = MONTH(CURDATE())
                        THEN 1
                        ELSE 0
                    END
                ) AS month_admissions,

                COALESCE(
                    SUM(a.final_fee),
                    0
                ) AS total_course_fee,

                COALESCE(
                    SUM(a.registration_amount),
                    0
                ) AS total_paid,

                COALESCE(
                    SUM(
                        CASE
                            WHEN ${paymentStatusCase} = 'Partial'
                            THEN a.registration_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS partial_payments,

                COALESCE(
                    SUM(a.balance_amount),
                    0
                ) AS pending_amount,

                COALESCE(
                    SUM(a.registration_amount),
                    0
                ) AS total_revenue

            FROM admissions a

            ${whereClause}
            `,
            params
        );

        const summary = summaryRows[0] || {};

        res.json({success: true,

            summary: {
                total_admissions: Number(summary.total_admissions) || 0,

                today_admissions: Number(summary.today_admissions) || 0,

                month_admissions: Number(summary.month_admissions) || 0,

                total_course_fee: Number(summary.total_course_fee) || 0,

                total_paid: Number(summary.total_paid) || 0,

                partial_payments: Number(summary.partial_payments) || 0,

                pending_amount: Number(summary.pending_amount) || 0,

                total_revenue: Number(summary.total_revenue) || 0
            },

            admissions

        });

    } catch (error) {

        console.error("❌ Admission Report Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load admission report.",
            error: error.message
        });
    }
});





/*==== GET SINGLE ADMISSION ====*/
app.get("/api/admissions/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [admissions] = await db.execute(`
            SELECT
                id, student_name, mobile, email, gender, date_of_birth, course, batch, joining_date, course_fee,
                discount, final_fee, registration_amount, balance_amount, payment_mode, counsellor, admission_status,
                documents, remarks, created_at, updated_at
            FROM admissions
            WHERE id = ?
        `, [id]);

        if (admissions.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Admission not found."
            });
        }

        res.json({
            success: true,
            admission: admissions[0]
        });

    } catch (error) {
        console.error("❌ Get Single Admission Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load admission.",
            error: error.message
        });
    }
});





/*==== DELETE ADMISSION ====*/
app.delete("/api/admissions/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.execute(
            `DELETE FROM admissions WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Admission not found."
            });
        }

        res.json({
            success: true,
            message: "Admission deleted successfully."
        });

    } catch (error) {
        console.error("❌ Delete Admission Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete admission.",
            error: error.message
        });
    }
});





/*==== UPDATE Manage Admission - PUT ====*/
app.put("/api/admissions/:id", async (req, res) => {
    try {

        const { id } = req.params;

        const {
            student_name, mobile, email, gender, date_of_birth, course, batch, joining_date, course_fee, discount,
            final_fee, registration_amount, balance_amount, payment_mode, counsellor, admission_status, remarks
        } = req.body;


        if (!student_name || !mobile || !course) {

            return res.status(400).json({
                success: false,
                message: "Student name, mobile number and course are required."
            });

        }


        const courseFee = Number(course_fee) || 0;

        const discountAmount = Number(discount) || 0;

        const registrationAmount = Number(registration_amount) || 0;

        let finalFee = Number(final_fee);

        if (
            isNaN(finalFee) ||
            finalFee < 0
        ) {
            finalFee = Math.max(
                    courseFee - discountAmount,
                    0
                );
        }


        let balanceAmount = Number(balance_amount);

        if (
            isNaN(balanceAmount) ||
            balanceAmount < 0
        ) {
            balanceAmount = Math.max(
                    finalFee -
                    registrationAmount,
                    0
                );
        }


        if (discountAmount > courseFee) {

            return res.status(400).json({
                success: false,
                message: "Discount cannot be greater than course fee."
            });

        }


        if (registrationAmount > finalFee) {

            return res.status(400).json({
                success: false,
                message: "Registration amount cannot be greater than final fee."
            });

        }


        const [result] = await db.execute(
            `
            UPDATE admissions
            SET
                student_name = ?, mobile = ?, email = ?, gender = ?, date_of_birth = ?, course = ?, batch = ?,
                joining_date = ?, course_fee = ?, discount = ?, final_fee = ?, registration_amount = ?, balance_amount = ?,
                payment_mode = ?, counsellor = ?, admission_status = ?, remarks = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
                student_name, mobile, email || null, gender || null, date_of_birth || null, course, batch || null,
                joining_date || null, courseFee, discountAmount, finalFee, registrationAmount, balanceAmount,
                payment_mode || null, counsellor || null, admission_status || "Confirmed",
                remarks || null,
                id
            ]
        );


        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "Admission not found."
            });

        }


        res.json({
            success: true,
            message: "Admission updated successfully.",
            admissionId: id
        });


    } catch (error) {

        console.error(
            "❌ Update Admission Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to update admission.",
            error: error.message
        });

    }
});





/*==== USERS - ADD USER ====*/
app.post("/api/users", async (req, res) => {

    try {

        const {
            full_name, email, mobile, username, password, role, status, department, joining_date, address
        } = req.body;


        /*--- VALIDATION ---*/
        if (
            !full_name ||
            !email ||
            !mobile ||
            !username ||
            !password ||
            !role ||
            !status
        ) {

            return res.status(400).json({
                success: false,
                message: "Please fill all required fields."
            });

        }


        if (!/^\d{10}$/.test(mobile)) {

            return res.status(400).json({
                success: false,
                message: "Mobile number must contain exactly 10 digits."
            });

        }


        if (password.length < 6) {

            return res.status(400).json({
                success: false,
                message: "Password must contain at least 6 characters."
            });

        }


        /*--- CHECK EMAIL ---*/
        const [existingEmail] = await db.execute(
            `
            SELECT id
            FROM add_users
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        );


        if (existingEmail.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Email address already exists."
            });

        }


        /*--- CHECK USERNAME ---*/
        const [existingUsername] = await db.execute(
            `
            SELECT id
            FROM add_users
            WHERE username = ?
            LIMIT 1
            `,
            [username]
        );


        if (existingUsername.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Username already exists."
            });

        }


        /*--- HASH PASSWORD ---*/
        const hashedPassword = await bcrypt.hash(password, 10);


        /*--- INSERT USER ---*/
        const [result] = await db.execute(
            `
            INSERT INTO add_users (
                full_name, email, mobile, username, password, role, status,
                department, joining_date, address
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                full_name, email, mobile, username, hashedPassword, role, status,
                department || null,
                joining_date || null,
                address || null
            ]
        );


        res.status(201).json({

            success: true,
            message: "✅ User created successfully.",
            userId: result.insertId

        });


    } catch (error) {

        console.error(
            "❌ Add User Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "❌ Failed to create user.",
            error: error.message

        });

    }

});





/*==== GET ALL USERS ====*/
app.get("/api/users", async (req, res) => {

    try {

        const [users] = await db.execute(
            `
            SELECT
                id, full_name, email, mobile, username, role, status, department, joining_date, address,
                created_at, updated_at
            FROM add_users
            ORDER BY id DESC
            `
        );


        res.json({

            success: true,
            users

        });


    } catch (error) {

        console.error(
            "❌ Get Users Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "Failed to load users.",
            error: error.message

        });

    }

});




 
/*==== GET ACTIVE COUNSELLORS ====*/
app.get("/api/users/counsellors", async (req, res) => {

    try {

        const [counsellors] = await db.execute(
            `
            SELECT
                id, full_name, username, email, mobile, department, status
            FROM add_users
            WHERE role = 'Counsellor'
              AND status = 'Active'
            ORDER BY full_name ASC
            `
        );


        res.json({

            success: true,
            counsellors

        });


    } catch (error) {

        console.error(
            "❌ Counsellors List Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "Failed to load counsellors.",
            error: error.message

        });

    }

});





/*==== GET SINGLE USER ====*/
app.get("/api/users/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await db.execute(`
            SELECT
                id, full_name, email, mobile, username, role, status, department, joining_date, address,
                created_at, updated_at
            FROM add_users
            WHERE id = ?
            LIMIT 1
        `, [id]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.json({
            success: true,
            user: users[0]
        });

    } catch (error) {
        console.error("❌ Get Single User Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load user.",
            error: error.message
        });
    }
});





/*==== TOGGLE USER STATUS ====*/
app.put("/api/users/:id/status", async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await db.execute(`
            SELECT id, status
            FROM add_users
            WHERE id = ?
            LIMIT 1
        `, [id]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const currentStatus = users[0].status;

        const newStatus = currentStatus === "Active"
                ? "Inactive"
                : "Active";

        await db.execute(`
            UPDATE add_users
            SET status = ?
            WHERE id = ?
        `, [newStatus, id]);

        res.json({
            success: true,
            message: `✅ User ${newStatus === "Active" ? "activated" : "deactivated"} successfully.`,
            status: newStatus
        });

    } catch (error) {
        console.error("❌ Toggle User Status Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update user status.",
            error: error.message
        });
    }
});





/*==== DELETE USER ====*/
app.delete("/api/users/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await db.execute(`
            SELECT id, full_name
            FROM add_users
            WHERE id = ?
            LIMIT 1
        `, [id]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        await db.execute(`
            DELETE FROM add_users
            WHERE id = ?
        `, [id]);

        res.json({
            success: true,
            message: "❌ User deleted successfully."
        });

    } catch (error) {
        console.error("❌ Delete User Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete user.",
            error: error.message
        });
    }
});





/*==== UPDATE USER ====*/
app.put("/api/users/:id", async (req, res) => {

    try {

        const userId = req.params.id;

        const {
            full_name, email, mobile, username, password, role, status, department, joining_date, address
        } = req.body;


        /*--- Required validation ---*/
        if (
            !full_name ||
            !email ||
            !mobile ||
            !username ||
            !role ||
            !status
        ) {

            return res.status(400).json({
                success: false,
                message: "Full name, email, mobile, username, role and status are required."
            });

        }


        /*--- Mobile validation ---*/
        if (!/^\d{10}$/.test(mobile)) {

            return res.status(400).json({
                success: false,
                message: "Mobile number must be exactly 10 digits."
            });

        }


        /*--- Check user exists ---*/
        const [existingUser] = await db.execute(
                `
                SELECT id
                FROM add_users
                WHERE id = ?
                LIMIT 1
                `,
                [userId]
            );


        if (existingUser.length === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found."
            });

        }


        /*--- Check duplicate email / username ---*/
        const [duplicateUser] = await db.execute(
                `
                SELECT id
                FROM add_users
                WHERE (email = ? OR username = ?)
                AND id != ?
                LIMIT 1
                `,
                [
                    email,
                    username,
                    userId
                ]
            );


        if (duplicateUser.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Email or username already exists for another user."
            });

        }


        /*--- Update WITHOUT password ---*/
        if (!password) {

            await db.execute(
                `
                UPDATE add_users
                SET
                    full_name = ?, email = ?, mobile = ?, username = ?, role = ?, status = ?, department = ?,
                    joining_date = ?, address = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [
                    full_name, email, mobile, username, role, status,
                    department || null,
                    joining_date || null,
                    address || null,
                    userId
                ]
            );

        }


        /*--- Update WITH new password ---*/
        else {

            if (password.length < 6) {

                return res.status(400).json({
                    success: false,
                    message: "Password must be at least 6 characters."
                });

            }

            const hashedPassword = await bcrypt.hash(password, 10);

            await db.execute(
                `
                UPDATE add_users
                SET
                    full_name = ?, email = ?, mobile = ?, username = ?, password = ?, role = ?, status = ?,
                    department = ?, joining_date = ?, address = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [
                    full_name, email, mobile, username, hashedPassword, role, status,
                    department || null,
                    joining_date || null,
                    address || null,
                    userId
                ]
            );

        }


        /*--- Success ---*/
        res.json({
            success: true,
            message: "✅ User updated successfully."
        });


    } catch (error) {

        console.error(
            "❌ Update User Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to update user.",
            error: error.message
        });

    }

});





/*==== DASHBOARD API ====*/
app.get("/api/dashboard", async (req, res) => {

    try {

        /*--- 1. TOTAL ENQUIRIES ---*/
        const [[enquiryCount]] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM student_enquiries
        `);


        /*--- 2. TODAY'S FOLLOW-UPS ---*/
        const [[todayFollowupCount]] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM follow_ups
            WHERE follow_up_date >= CURDATE()
              AND follow_up_date < CURDATE() + INTERVAL 1 DAY
        `);


        /*--- 3. TOTAL ADMISSIONS ---*/
        const [[admissionCount]] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM admissions
        `);


        /*--- 4. TOTAL USERS ---*/
        const [[userCount]] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM add_users
        `);


        /*--- 5. TODAY'S FOLLOW-UPS LIST ---*/
        const [todayFollowups] = await db.execute(`
            SELECT
                id, student_name, mobile_number, course, counsellor, follow_up_date, follow_up_time, follow_up_type,
                status, comments
            FROM follow_ups
            WHERE DATE(follow_up_date) = CURDATE()
            ORDER BY
                CASE
                    WHEN follow_up_time IS NULL THEN 1
                    ELSE 0
                END,
                follow_up_time ASC
            LIMIT 4
        `);


        /*--- 6. RECENT STUDENT ENQUIRIES ---*/
        const [recentEnquiries] = await db.execute(`
            SELECT
                id, student_name, mobile, course_interested, status, counsellor,
                enquiry_date, created_at
            FROM student_enquiries
            ORDER BY id DESC
            LIMIT 4
        `);


        /*--- 7. TODAY'S NEW ENQUIRIES ---*/
        const [[todayEnquiryCount]] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM student_enquiries
            WHERE DATE(enquiry_date) = CURDATE()
        `);


        /*--- 8. TODAY'S ADMISSIONS ---*/
        const [[todayAdmissionCount]] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM admissions
            WHERE DATE(created_at) = CURDATE()
               OR DATE(joining_date) = CURDATE()
        `);


        /*--- 9. MISSED FOLLOW-UPS ---*/
        const [[missedFollowupCount]] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM follow_ups
            WHERE
            (
                DATE(follow_up_date) < CURDATE()

                OR

                (
                    DATE(follow_up_date) = CURDATE()
                    AND follow_up_time IS NOT NULL
                    AND follow_up_time < CURTIME()
                )
            )
            AND status NOT IN ('Completed', 'Not Interested')
        `);


        /*--- 10. RECENT NOTIFICATIONS ---*/
        const [notifications] = await db.execute(`

            SELECT *
            FROM (

                /* Today's Follow-up */
                SELECT
                    f.id AS reference_id,
                    'followup' AS notification_type,
                    'Follow-up' AS title,
                    CONCAT(
                        f.student_name,
                        ' follow-up at ',
                        TIME_FORMAT(f.follow_up_time, '%h:%i %p')
                    ) AS message,
                    f.created_at AS notification_date
                FROM follow_ups f
                WHERE DATE(f.follow_up_date) = CURDATE()

                UNION ALL

                /* New Enquiry */
                SELECT
                    e.id AS reference_id,
                    'enquiry' AS notification_type,
                    'New Enquiry' AS title,
                    CONCAT(
                        e.student_name,
                        ' submitted a new enquiry'
                    ) AS message,
                    e.created_at AS notification_date
                FROM student_enquiries e
                WHERE DATE(e.enquiry_date) = CURDATE()

                UNION ALL

                /* New Admission */
                SELECT
                    a.id AS reference_id,
                    'admission' AS notification_type,
                    'New Admission' AS title,
                    CONCAT(
                        a.student_name,
                        ' admission completed'
                    ) AS message,
                    a.created_at AS notification_date
                FROM admissions a
                WHERE DATE(a.created_at) = CURDATE()
                   OR DATE(a.joining_date) = CURDATE()

            ) AS dashboard_notifications

            ORDER BY notification_date DESC

            LIMIT 3

        `);


        /*--- 11. RESPONSE ---*/
        res.json({

            success: true,
            summary: {

                total_enquiries:
                    Number(enquiryCount.total) || 0,

                today_followups:
                    Number(todayFollowupCount.total) || 0,

                admissions:
                    Number(admissionCount.total) || 0,

                users:
                    Number(userCount.total) || 0,

                today_enquiries:
                    Number(todayEnquiryCount.total) || 0,

                today_admissions:
                    Number(todayAdmissionCount.total) || 0,

                missed_followups:
                    Number(missedFollowupCount.total) || 0

            },

            todayFollowups,

            recentEnquiries,

            notifications

        });


    } catch (error) {

        console.error(
            "❌ Dashboard API Error:",
            error
        );


        res.status(500).json({

            success: false,
            message: "Failed to load dashboard data.",
            error: error.message

        });

    }

});












































































































































































/*--------------------------------------- Employee Side Backend Code --------------------------------------*/    


function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication token required."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "temporary-secret"
        );

        req.user = decoded;

        next();

    } catch (error) {

        console.error("❌ JWT Error:", error);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token."
        });
    }
}





/*==== Employee Dashboard - Get Method ====*/
app.get("/api/employee/dashboard", authenticateToken, async (req, res) => {

    try {

        const employeeId = req.user.id;
        const employeeRole = req.user.role;

        console.log(
            `👤 Employee Dashboard Request: ID=${employeeId}, Role=${employeeRole}`
        );

        /*--- ONLY COUNSELLOR / STAFF ---*/

        if (
            employeeRole !== "Counsellor" &&
            employeeRole !== "Staff"
        ) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Employee dashboard only."
            });
        }


        /*--- EMPLOYEE INFORMATION ---*/
        const [employeeRows] = await db.execute(`
            SELECT
                id, full_name, email, mobile, username, role, status, department, joining_date, address
            FROM add_users
            WHERE id = ?
            LIMIT 1
        `, [employeeId]);


        if (!employeeRows.length) {

            return res.status(404).json({
                success: false,
                message: "Employee account not found."
            });
        }

        const employee = employeeRows[0];


        /*--- MY ENQUIRIES COUNT ---*/
        const [enquiryCountRows] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM student_enquiries
            WHERE counsellor_id = ?
        `, [employeeId]);


        const totalEnquiries = Number(enquiryCountRows[0].total) || 0;


        /*--- TODAY'S FOLLOW-UPS COUNT ---*/
        const [todayFollowupRows] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM follow_ups
            WHERE counsellor_id = ?
              AND DATE(follow_up_date) = CURDATE()
              AND status NOT IN ('Completed', 'Not Interested')
        `, [employeeId]);


        const todayFollowups = Number(todayFollowupRows[0].total) || 0;


        /*--- MY ADMISSIONS COUNT ---*/
        const [admissionCountRows] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM admissions
            WHERE counsellor_id = ?
        `, [employeeId]);


        const totalAdmissions = Number(admissionCountRows[0].total) || 0;


        /*--- MISSED FOLLOW-UPS ---*/
        const [missedFollowupRows] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM follow_ups
            WHERE counsellor_id = ?
              AND (
                    DATE(follow_up_date) < CURDATE()
                    OR (
                        DATE(follow_up_date) = CURDATE()
                        AND follow_up_time < CURTIME()
                    )
                  )
              AND status NOT IN ('Completed', 'Not Interested')
        `, [employeeId]);


        const missedFollowups = Number(missedFollowupRows[0].total) || 0;


        /*--- RECENT MY ENQUIRIES ---*/
        const [recentEnquiries] = await db.execute(`
            SELECT
                id, student_name, mobile, email, course_interested, enquiry_source, counsellor, enquiry_date, follow_up_date,
                follow_up_time, status
            FROM student_enquiries
            WHERE counsellor_id = ?
            ORDER BY id DESC
            LIMIT 5
        `, [employeeId]);


        /*--- TODAY'S MY FOLLOW-UPS ---*/
        const [todayFollowupsList] = await db.execute(`
            SELECT
                id, enquiry_id, student_name, mobile_number, course, counsellor, follow_up_date, follow_up_time,
                follow_up_type, status, next_follow_up_date, next_follow_up_time, comments
            FROM follow_ups
            WHERE counsellor_id = ?
              AND DATE(follow_up_date) = CURDATE()
              AND status NOT IN ('Completed', 'Not Interested')
            ORDER BY follow_up_time ASC
        `, [employeeId]);


        /*--- RECENT MY ADMISSIONS ---*/
        const [recentAdmissions] = await db.execute(`
            SELECT
                id, student_name, mobile, email, course, batch, joining_date, course_fee, final_fee,
                registration_amount, balance_amount, payment_mode, counsellor, admission_status
            FROM admissions
            WHERE counsellor_id = ?
            ORDER BY id DESC
            LIMIT 5
        `, [employeeId]);


        /*--- MY UPCOMING FOLLOW-UPS ---*/
        const [upcomingFollowups] = await db.execute(`
            SELECT
                id, student_name, mobile_number, course, counsellor, follow_up_date, follow_up_time, follow_up_type, status
            FROM follow_ups
            WHERE counsellor_id = ?
              AND DATE(follow_up_date) > CURDATE()
              AND status NOT IN ('Completed', 'Not Interested')
            ORDER BY follow_up_date ASC,
                     follow_up_time ASC
            LIMIT 5
        `, [employeeId]);


        /*--- EMPLOYEE NOTIFICATIONS ---*/
        const notifications = [];


        /*--- Today's follow-ups ---*/
        if (todayFollowups > 0) {

            notifications.push({
                type: "follow-up",
                title: "Today's Follow-ups",
                message:
                    `You have ${todayFollowups} follow-up(s) scheduled today.`,
                count: todayFollowups
            });
        }


        /*--- Missed follow-ups ---*/
        if (missedFollowups > 0) {

            notifications.push({
                type: "missed-follow-up",
                title: "Missed Follow-ups",
                message:
                    `You have ${missedFollowups} missed follow-up(s).`,
                count: missedFollowups
            });
        }


        /*--- No notification ---*/
        if (notifications.length === 0) {

            notifications.push({
                type: "info",
                title: "All Clear",
                message:
                    "You have no pending notifications.",
                count: 0
            });
        }


        /*--- FINAL RESPONSE ---*/
        res.json({

            success: true,
            employee: {
                id: employee.id,
                full_name: employee.full_name,
                email: employee.email,
                mobile: employee.mobile,
                username: employee.username,
                role: employee.role,
                status: employee.status,
                department: employee.department,
                joining_date: employee.joining_date,
                address: employee.address
            },

            summary: {
                total_enquiries: totalEnquiries,
                today_followups: todayFollowups,
                total_admissions: totalAdmissions,
                missed_followups: missedFollowups
            },

            recent_enquiries: recentEnquiries,
            today_followups: todayFollowupsList,
            recent_admissions: recentAdmissions,
            upcoming_followups: upcomingFollowups,
            notifications: notifications
        });

    } catch (error) {

        console.error(
            "❌ Employee Dashboard Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to load employee dashboard.",
            error: error.message
        });
    }
});





/*==== Employee - Add enquiry ====*/
app.post("/api/employee/enquiries", authenticateToken,
    async (req, res) => {
        try {
            const userId = req.user.id;

            /*-- Only employee roles can use this endpoint. --*/
            if (!["Counsellor", "Staff"].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "Only employees can add enquiries through this page."
                });
            }

            const {
                studentName, mobile, email, gender, dateOfBirth, courseInterested, enquirySource, enquiryDate,
                followUpDate, followUpTime, status, address, comments
            } = req.body;

            /*-- Required-field validation. --*/
            if (
                typeof studentName !== "string" ||
                !studentName.trim() ||
                typeof mobile !== "string" ||
                !mobile.trim() ||
                typeof courseInterested !== "string" ||
                !courseInterested.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Student name, mobile number and course are required."
                });
            }

            if (!/^[0-9+\-\s()]{7,15}$/.test(mobile.trim())) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid mobile number."
                });
            }

            /*-- Confirm the logged-in account still exists and is active. --*/
            const [users] = await db.execute(
                `SELECT id, full_name, role, status
                 FROM add_users
                 WHERE id = ?
                 LIMIT 1`,
                [userId]
            );

            if (
                users.length === 0 ||
                users[0].status !== "Active" ||
                !["Counsellor", "Staff"].includes(users[0].role)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is inactive or not authorized."
                });
            }

            const employee = users[0];
            const savedEnquiryDate = enquiryDate || new Date().toISOString().slice(0, 10);

            const [result] = await db.execute(
                `INSERT INTO student_enquiries (
                    student_name, mobile, email, gender, date_of_birth, course_interested, enquiry_source, counsellor,
                    counsellor_id, enquiry_date, follow_up_date, follow_up_time, status, address, comments
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    studentName.trim(),
                    mobile.trim(),
                    email?.trim() || null,
                    gender || null,
                    dateOfBirth || null,
                    courseInterested,
                    enquirySource || null,
                    employee.full_name,
                    employee.id,
                    savedEnquiryDate,
                    followUpDate || null,
                    followUpTime || null,
                    status || "New",
                    address?.trim() || null,
                    comments?.trim() || null
                ]
            );

            return res.status(201).json({
                success: true,
                message: "✅ Enquiry saved successfully.",
                enquiryId: result.insertId
            });

        } catch (error) {
            console.error("Employee Add Enquiry Error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to save enquiry. Please try again."
            });
        }
    }
);





/*==== Get Employee - My Enquiries ====*/
app.get("/api/employee/enquiries", authenticateToken,
    async (req, res) => {
        try {

            /*-- Allow employee roles only. --*/
            if (!["Counsellor", "Staff"].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "Only employees can access their enquiries."
                });
            }

            const userId = req.user.id;

            /*-- Verify that the account is active. --*/
            const [users] = await db.execute(
                `SELECT id, role, status
                 FROM add_users
                 WHERE id = ?
                 LIMIT 1`,
                [userId]
            );

            if (
                users.length === 0 ||
                users[0].status !== "Active" ||
                !["Counsellor", "Staff"].includes(users[0].role)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is inactive or not authorized."
                });
            }

            /*-- Pagination. --*/
            const page = Math.max(
                1,
                parseInt(req.query.page, 10) || 1
            );

            const limit = Math.min(
                100,
                Math.max(1, parseInt(req.query.limit, 10) || 10)
            );

            const offset = (page - 1) * limit;

            /*-- Filters. --*/
            const search = String(req.query.search || "").trim();
            const course = String(req.query.course || "").trim();
            const status = String(req.query.status || "").trim();

            const conditions = ["counsellor_id = ?"];
            const values = [userId];

            if (search) {
                conditions.push(
                    "(student_name LIKE ? OR mobile LIKE ? OR email LIKE ?)"
                );

                const searchValue = `%${search}%`;
                values.push(searchValue, searchValue, searchValue);
            }

            if (course) {
                conditions.push("course_interested = ?");
                values.push(course);
            }

            if (status) {
                conditions.push("status = ?");
                values.push(status);
            }

            const whereClause = conditions.join(" AND ");

            /*-- Count matching records. --*/
            const [countRows] = await db.execute(
                `SELECT COUNT(*) AS total
                 FROM student_enquiries
                 WHERE ${whereClause}`,
                values
            );

            const total = Number(countRows[0].total);
            const totalPages = Math.ceil(total / limit);

            /*-- Fetch this page of enquiries --*/
            const [enquiries] = await db.execute(
            `SELECT
                id, student_name, mobile, email, course_interested, counsellor, 
                DATE_FORMAT(enquiry_date, '%Y-%m-%d') AS enquiry_date,
                DATE_FORMAT(follow_up_date, '%Y-%m-%d') AS follow_up_date,
                status
            FROM student_enquiries
            WHERE ${whereClause}
            ORDER BY id DESC
            LIMIT ${limit} OFFSET ${offset}`,
            values
        );

        /*-- Load available course filters for this employee --*/
        const [courseRows] = await db.execute(
        `SELECT DISTINCT course_interested
            FROM student_enquiries
            WHERE counsellor_id = ?
                AND course_interested IS NOT NULL
                AND course_interested <> ''
            ORDER BY course_interested`,
            [Number(req.user.id)]
        );

        /*-- Load available status filters for this employee --*/
        const [statusRows] = await db.execute(
        `SELECT DISTINCT status
            FROM student_enquiries
            WHERE counsellor_id = ?
                AND status IS NOT NULL
                AND status <> ''
            ORDER BY status`,
            [Number(req.user.id)]
        );

        return res.json({
            success: true,
            enquiries,
            pagination: {
                page,
                limit,
                total,
                totalPages
            },
        filters: {
            courses: courseRows.map(row => row.course_interested),
            statuses: statusRows.map(row => row.status)
        }
    });

        } catch (error) {
            console.error("Employee My Enquiries Error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load enquiries."
            });
        }
    }
);





/*==== EMPLOYEE ADD FOLLOW-UP ====*/
app.post("/api/employee/follow-ups", authenticateToken,
    async (req, res) => {
        try {

            /*-- 1. Verify role from the authenticated token. --*/
            if (!["Counsellor", "Staff"].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "Only employees can add follow-ups."
                });
            }

            const userId = Number(req.user.id);

            if (!Number.isSafeInteger(userId) || userId <= 0) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid login session. Please log in again."
                });
            }

            /*-- 2. Read the fields sent by add-follow-up.html. --*/
            const {
                enquiry_id, follow_up_date, follow_up_time, follow_up_type, outcome, follow_up_status, next_follow_up_date,
                next_follow_up_time, comments
            } = req.body || {};

            const enquiryId = Number(enquiry_id);

            const allowedTypes = [
                "Phone Call", "WhatsApp", "Email", "Walk-in"
            ];

            const allowedOutcomes = [
                "Interested", "Not Interested", "Call Back", "Admission Confirmed"
            ];

            const allowedFollowUpStatuses = [
                "Pending", "Scheduled", "Completed", "Missed"
            ];

            /*-- 3. Validate required fields and dropdown values. --*/
            if (
                !Number.isSafeInteger(enquiryId) ||
                enquiryId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a valid student enquiry."
                });
            }

            if (
                typeof follow_up_date !== "string" ||
                !isValidFollowUpDate_(follow_up_date)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid follow-up date."
                });
            }

            if (
                typeof follow_up_time !== "string" ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(follow_up_time)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid follow-up time."
                });
            }

            if (!allowedTypes.includes(follow_up_type)) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a valid follow-up type."
                });
            }

            if (!allowedOutcomes.includes(outcome)) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a valid student outcome."
                });
            }

            if (!allowedFollowUpStatuses.includes(follow_up_status)) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a valid follow-up status."
                });
            }

            if (
                next_follow_up_date != null &&
                next_follow_up_date !== "" &&
                !isValidFollowUpDate_(next_follow_up_date)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid next follow-up date."
                });
            }

            if (
                next_follow_up_time != null &&
                next_follow_up_time !== "" &&
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(next_follow_up_time)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid next follow-up time."
                });
            }

            if (
                next_follow_up_date &&
                next_follow_up_date < follow_up_date
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Next follow-up date cannot be earlier than the current follow-up date."
                });
            }

            /*-- 4. Confirm that the logged-in employee is active. --*/
            const [users] = await db.execute(
                `SELECT id, full_name, role, status
                 FROM add_users
                 WHERE id = ?
                 LIMIT 1`,
                [userId]
            );

            if (
                !users.length ||
                users[0].status !== "Active" ||
                !["Counsellor", "Staff"].includes(users[0].role)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is inactive or unauthorized."
                });
            }

            const employee = users[0];

            /*-- 5. Verify ownership of the selected enquiry. --*/
            const [enquiries] = await db.execute(
                `SELECT
                    id, student_name, mobile, course_interested, counsellor_id
                 FROM student_enquiries
                 WHERE id = ?
                   AND counsellor_id = ?
                 LIMIT 1`,
                [enquiryId, employee.id]
            );

            if (!enquiries.length) {
                return res.status(403).json({
                    success: false,
                    message: "This enquiry is not assigned to your account."
                });
            }

            const enquiry = enquiries[0];

            /*-- 6. Insert the follow-up using verified student and employee data. --*/
            const [insertResult] = await db.execute(
                `INSERT INTO follow_ups (
                    enquiry_id, student_name, mobile_number, course, counsellor, counsellor_id, follow_up_date, follow_up_time,
                    follow_up_type, status, follow_up_status, next_follow_up_date, next_follow_up_time, comments
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    enquiry.id, enquiry.student_name, enquiry.mobile, enquiry.course_interested, employee.full_name, employee.id,
                    follow_up_date, follow_up_time, follow_up_type, outcome, follow_up_status,
                    next_follow_up_date || null,
                    next_follow_up_time || null,
                    comments ? String(comments).trim() : null
                ]
            );

            /*-- 7. Send success response. --*/
            return res.status(201).json({
                success: true,
                message: "✅ Follow-up saved successfully.",
                follow_up_id: insertResult.insertId
            });

        } catch (error) {
            console.error("Employee Add Follow-up Error:", {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage
            });

            return res.status(500).json({
                success: false,
                message: "Unable to save follow-up. Please check the backend error log."
            });
        }
    }
);


/*--- DATE VALIDATION HELPER ---*/
function isValidFollowUpDate_(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}





/*==== EMPLOYEE MY FOLLOW-UPS  -  GET /api/employee/follow-ups ====*/
app.get("/api/employee/follow-ups", authenticateToken,
    async (req, res) => {
        try {
            if (!["Counsellor", "Staff"].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to view these follow-ups."
                });
            }

            const userId = Number(req.user.id);

            if (!Number.isSafeInteger(userId) || userId <= 0) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid login session."
                });
            }

            /*--- Verify that the employee account is still active. ---*/
            const [users] = await db.execute(
                `SELECT id, status, role
                 FROM add_users
                 WHERE id = ?
                 LIMIT 1`,
                [userId]
            );

            if (
                !users.length ||
                users[0].status !== "Active" ||
                !["Counsellor", "Staff"].includes(users[0].role)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is inactive or unauthorized."
                });
            }

            const [rows] = await db.execute(
                `SELECT
                    f.id, f.enquiry_id, f.student_name, f.mobile_number, f.course,
                    COALESCE(NULLIF(f.counsellor, ''), e.counsellor) AS counsellor,
                    f.follow_up_date, f.follow_up_time, f.follow_up_type, f.follow_up_status AS status, f.status AS outcome,
                    f.next_follow_up_date, f.next_follow_up_time, f.comments, f.created_at, f.updated_at
                 FROM follow_ups AS f
                 INNER JOIN student_enquiries AS e
                    ON e.id = f.enquiry_id
                 WHERE e.counsellor_id = ?
                 ORDER BY f.follow_up_date ASC,
                          f.follow_up_time ASC,
                          f.id DESC`,
                [userId]
            );

            /*--- Summary counts are calculated from the same employee's records. ---*/
            const [summaryRows] = await db.execute(
                `SELECT
                    COUNT(*) AS total_followups,
                    COALESCE(SUM(f.follow_up_date = CURDATE()), 0)
                        AS today_followups,
                    COALESCE(SUM(f.follow_up_status = 'Pending'), 0)
                        AS pending_followups,
                    COALESCE(SUM(f.follow_up_status = 'Completed'), 0)
                        AS completed_followups,
                    COALESCE(SUM(
                        f.follow_up_status = 'Missed'
                    ), 0) AS missed_followups
                 FROM follow_ups AS f
                 INNER JOIN student_enquiries AS e
                    ON e.id = f.enquiry_id
                 WHERE e.counsellor_id = ?`,
                [userId]
            );

            return res.json({
                success: true,
                follow_ups: rows,
                summary: summaryRows[0]
            });

        } catch (error) {
            console.error("Employee My Follow-ups Error:", {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage
            });

            return res.status(500).json({
                success: false,
                message: "Unable to load your follow-ups."
            });
        }
    }
);





/*==== COMPLETE EMPLOYEE FOLLOW-UP  -  PUT /api/employee/follow-ups/:id/complete ====*/
app.put("/api/employee/follow-ups/:id/complete", authenticateToken,
    async (req, res) => {
        try {

            /*--- Allow employees only. ---*/
            if (!["Counsellor", "Staff"].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to complete follow-ups."
                });
            }

            const userId = Number(req.user.id);
            const followUpId = Number(req.params.id);

            if (
                !Number.isSafeInteger(userId) ||
                userId <= 0 ||
                !Number.isSafeInteger(followUpId) ||
                followUpId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid employee or follow-up ID."
                });
            }

            /*--- Verify the employee account is active. ---*/
            const [users] = await db.execute(
                `SELECT id, role, status
                 FROM add_users
                 WHERE id = ?
                 LIMIT 1`,
                [userId]
            );

            if (
                !users.length ||
                users[0].status !== "Active" ||
                !["Counsellor", "Staff"].includes(users[0].role)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is inactive or unauthorized."
                });
            }

            /*--- Verify that this follow-up belongs to one of ---*/
            const [followUps] = await db.execute(
                `SELECT f.id, f.follow_up_status
                 FROM follow_ups AS f
                 INNER JOIN student_enquiries AS e
                     ON e.id = f.enquiry_id
                 WHERE f.id = ?
                   AND e.counsellor_id = ?
                 LIMIT 1`,
                [followUpId, userId]
            );

            if (!followUps.length) {
                return res.status(404).json({
                    success: false,
                    message: "Follow-up not found or not assigned to you."
                });
            }

            if (followUps[0].follow_up_status === "Completed") {
                return res.json({
                    success: true,
                    message: "This follow-up is already completed."
                });
            }

            /*--- Update the task status, NOT the student outcome. ---*/
            const [updateResult] = await db.execute(
                `UPDATE follow_ups
                 SET follow_up_status = 'Completed'
                 WHERE id = ?`,
                [followUpId]
            );

            if (updateResult.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Follow-up could not be updated."
                });
            }

            return res.json({
                success: true,
                message: "Follow-up completed successfully.",
                follow_up_id: followUpId,
                follow_up_status: "Completed"
            });

        } catch (error) {
            console.error("Complete Employee Follow-up Error:", {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage
            });

            return res.status(500).json({
                success: false,
                message: "Unable to complete follow-up."
            });
        }
    }
);





/*==== DOCUMENT UPLOAD CONFIGURATION ====*/
const admissionDocumentsDir = path.join(
    __dirname,
    "uploads",
    "admissions"
);

fs.mkdirSync(admissionDocumentsDir, { recursive: true });

const admissionStorage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, admissionDocumentsDir);
    },

    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `${crypto.randomUUID()}${extension}`);
    }
});

const admissionUpload = multer({storage: admissionStorage,

    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB per file
        files: 5
    },

    fileFilter: (req, file, callback) => {
        const allowedExtensions = [
            ".pdf", ".jpg", ".jpeg", ".png"
        ];

        const extension = path.extname(file.originalname).toLowerCase();

        const allowedMimeTypes = [
            "application/pdf", "image/jpeg", "image/png"
        ];

        if (
            !allowedExtensions.includes(extension) ||
            !allowedMimeTypes.includes(file.mimetype)
        ) {
            return callback(
                new Error("Only PDF, JPG, JPEG and PNG files are allowed.")
            );
        }

        callback(null, true);
    }
});



/*==== HELPER FUNCTIONS ====*/
function isValidAdmissionDate(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

function normalizeAdmissionOptional(value) {
    if (value == null) {
        return null;
    }

    const text = String(value).trim();

    if (!text || text.startsWith("--")) {
        return null;
    }

    return text;
}

function removeAdmissionUploads(files = []) {
    for (const file of files) {
        try {
            if (file.path && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        } catch (error) {
            console.error(
                "Could not remove failed admission upload:",
                error.message
            );
        }
    }
}

function handleAdmissionUpload(req, res, next) {
    admissionUpload.array("documents", 5)(req, res, error => {
        if (!error) {
            return next();
        }

        const statusCode = error instanceof multer.MulterError ? 400 : 400;

        return res.status(statusCode).json({
            success: false,
            message: error.message || "Document upload failed."
        });
    });
}



/*==== EMPLOYEE ACCESS CHECK ====*/
async function getActiveAdmissionEmployee(userId) {
    const [rows] = await db.execute(
        `SELECT id, full_name, role, status
         FROM add_users
         WHERE id = ?
         LIMIT 1`,
        [userId]
    );

    if (
        !rows.length ||
        rows[0].status !== "Active" ||
        !["Counsellor", "Staff"].includes(rows[0].role)
    ) {
        return null;
    }

    return rows[0];
}





/*==== GET ACTIVE COURSES  -  GET /api/employee/admissions/courses ====*/
app.get("/api/employee/admissions/courses", authenticateToken,
    async (req, res) => {
        try {
            if (!["Counsellor", "Staff"].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "Only employees can access this endpoint."
                });
            }

            const userId = Number(req.user.id);

            if (!Number.isSafeInteger(userId) || userId <= 0) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid login session."
                });
            }

            const employee = await getActiveAdmissionEmployee(userId);

            if (!employee) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is inactive or unauthorized."
                });
            }

            const [courses] = await db.execute(
                `SELECT
                    id,
                    course_name, course_category, course_fee
                 FROM courses
                 WHERE status = 'Active'
                 ORDER BY course_name ASC`
            );

            return res.json({
                success: true,
                courses
            });

        } catch (error) {
            console.error("Employee Admission Courses Error:", {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage
            });

            return res.status(500).json({
                success: false,
                message: "Unable to load courses."
            });
        }
    }
);





/*==== POST NEW ADMISSION  -  POST /api/employee/admissions ====*/
app.post("/api/employee/admissions", authenticateToken,

    /*-- Reject unauthorized roles before accepting uploads. --*/
    (req, res, next) => {
        if (!["Counsellor", "Staff"].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "Only employees can create admissions."
            });
        }

        next();
    },

    handleAdmissionUpload,

    async (req, res) => {
        try {
            const userId = Number(req.user.id);

            if (!Number.isSafeInteger(userId) || userId <= 0) {
                removeAdmissionUploads(req.files);

                return res.status(401).json({
                    success: false,
                    message: "Invalid login session."
                });
            }

            const employee = await getActiveAdmissionEmployee(userId);

            if (!employee) {
                removeAdmissionUploads(req.files);

                return res.status(403).json({
                    success: false,
                    message: "Your account is inactive or unauthorized."
                });
            }

            /*--- Read submitted form fields. ---*/
            const studentName = String(
                req.body.student_name || ""
            ).trim();

            const mobile = String(
                req.body.mobile || ""
            ).trim();

            const email = normalizeAdmissionOptional(req.body.email);
            const gender = normalizeAdmissionOptional(req.body.gender);
            const dateOfBirth = normalizeAdmissionOptional(req.body.date_of_birth);
            const courseName = String(req.body.course || "").trim();
            const batch = normalizeAdmissionOptional(req.body.batch);
            const joiningDate = normalizeAdmissionOptional(req.body.joining_date);
            const paymentMode = normalizeAdmissionOptional(req.body.payment_mode);
            const admissionStatus = normalizeAdmissionOptional(req.body.admission_status) || "Pending";
            const remarks = normalizeAdmissionOptional(req.body.remarks);

            /*--- Basic validation. ---*/
            if (!studentName) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "Student name is required."
                });
            }

            if (!/^\d{10}$/.test(mobile)) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "Enter a valid 10-digit mobile number."
                });
            }

            if (!courseName) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "Please select a course."
                });
            }

            if (
                gender &&
                !["Male", "Female", "Other"].includes(gender)
            ) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "Invalid gender selection."
                });
            }

            if (
                dateOfBirth &&
                !isValidAdmissionDate(dateOfBirth)
            ) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "Invalid date of birth."
                });
            }

            if (
                joiningDate &&
                !isValidAdmissionDate(joiningDate)
            ) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "Invalid joining date."
                });
            }

            if (
                batch &&
                !["Morning", "Afternoon", "Evening", "Weekend"].includes(batch)
            ) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "Invalid batch selection."
                });
            }

            if (
                paymentMode &&
                !["Cash", "UPI", "Credit Card", "Debit Card", "Bank Transfer"]
                    .includes(paymentMode)
            ) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "Invalid payment mode."
                });
            }

            if (
                !["Confirmed", "Pending", "Cancelled"].includes(admissionStatus)
            ) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "Invalid admission status."
                });
            }

            
            
            const [courseRows] = await db.execute(
                `SELECT id, course_name, course_fee, status
                 FROM courses
                 WHERE course_name = ?
                   AND status = 'Active'
                 LIMIT 1`,
                [courseName]
            );

            if (!courseRows.length) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "The selected course is not active or does not exist."
                });
            }

            const selectedCourse = courseRows[0];
            const courseFee = Number(selectedCourse.course_fee) || 0;

            
            const discount = Number(req.body.discount || 0);
            const registrationAmount = Number(req.body.registration_amount || 0);

            if (
                !Number.isFinite(discount) ||
                !Number.isFinite(registrationAmount) ||
                discount < 0 ||
                registrationAmount < 0
            ) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "Discount and registration amount must be valid non-negative numbers."
                });
            }

            const finalFee = Math.max(0, courseFee - discount);

            if (discount > courseFee) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "Discount cannot exceed the course fee."
                });
            }

            if (registrationAmount > finalFee) {
                removeAdmissionUploads(req.files);

                return res.status(400).json({
                    success: false,
                    message: "Registration amount cannot exceed the final fee."
                });
            }

            const balanceAmount = finalFee - registrationAmount;

            const files = Array.isArray(req.files) ? req.files : [];

            const documents = files.length
                ? JSON.stringify(
                    files.map(file => ({
                        filename: file.filename,
                        originalName: file.originalname,
                        mimeType: file.mimetype,
                        size: file.size
                    }))
                )
                : null;

            
            const [insertResult] = await db.execute(
                `INSERT INTO admissions (
                    student_name, mobile, email, gender, date_of_birth, course, batch, joining_date, course_fee, discount,
                    final_fee, registration_amount, balance_amount, payment_mode, counsellor, counsellor_id, admission_status,
                    documents, remarks
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    studentName, mobile, email, gender, dateOfBirth, selectedCourse.course_name, batch, joiningDate, courseFee,
                    discount, finalFee, registrationAmount, balanceAmount, paymentMode, employee.full_name, employee.id,
                    admissionStatus, documents, remarks
                ]
            );

            return res.status(201).json({
                success: true,
                message: "Admission saved successfully.",
                admission_id: insertResult.insertId
            });

        } catch (error) {
            
            removeAdmissionUploads(req.files);

            console.error("Employee Save Admission Error:", {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage
            });

            return res.status(500).json({
                success: false,
                message: "Unable to save admission. Check the backend error log."
            });
        }
    }
);





/*==== EMPLOYEE MY ADMISSIONS  -  GET /api/employee/admissions ====*/
app.get("/api/employee/admissions", authenticateToken,
    async (req, res) => {
        try {
            if (!["Counsellor", "Staff"].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "Only employees can access My Admissions."
                });
            }

            const userId = Number(req.user.id);

            if (!Number.isSafeInteger(userId) || userId <= 0) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid login session."
                });
            }

            /*--- Verify that the employee is still active. ---*/
            const [users] = await db.execute(
                `SELECT id, full_name, role, status
                 FROM add_users
                 WHERE id = ?
                 LIMIT 1`,
                [userId]
            );

            if (
                !users.length ||
                users[0].status !== "Active" ||
                !["Counsellor", "Staff"].includes(users[0].role)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is inactive or unauthorized."
                });
            }

            /*--- Return only admissions assigned to this logged-in employee. ---*/
            const [admissions] = await db.execute(
                `SELECT
                    id, student_name, mobile, email, gender, date_of_birth, course, batch, joining_date, course_fee,
                    discount, final_fee, registration_amount, balance_amount, payment_mode, counsellor, counsellor_name, counsellor_id,
                    admission_status, documents, remarks, created_at, updated_at
                 FROM admissions
                 WHERE counsellor_id = ?
                 ORDER BY id DESC`,
                [userId]
            );

            return res.status(200).json({
                success: true,
                admissions
            });

        } catch (error) {
            console.error("Employee My Admissions Error:", {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage
            });

            return res.status(500).json({
                success: false,
                message: "Unable to load your admissions."
            });
        }
    }
);





/*==== Employee Notification - Get Method ====*/
app.get("/api/employee/notifications", authenticateToken, async (req, res) => {

        try {

            const employeeId = req.user.id;
            const employeeRole = req.user.role;

            /*--- Employee access check ---*/
            if (
                employeeRole !== "Counsellor" &&
                employeeRole !== "Staff"
            ) {

                return res.status(403).json({
                    success: false,
                    message: "Access denied. Employee notifications only."
                });

            }

            /*--- Verify employee ---*/
            const [employees] = await db.execute(
                `
                SELECT
                    id, full_name, role, status
                FROM add_users
                WHERE id = ?
                LIMIT 1
                `,
                [employeeId]
            );


            if (!employees.length) {

                return res.status(404).json({
                    success: false,
                    message: "Employee account not found."
                });

            }

            const employee = employees[0];

            if (employee.status !== "Active") {

                return res.status(403).json({
                    success: false,
                    message: "Your account is inactive."
                });

            }


            /*--- Today's follow-ups ---*/
            const [todayFollowupsRows] = await db.execute(
                    `
                    SELECT
                        COUNT(*) AS total
                    FROM follow_ups
                    WHERE counsellor_id = ?
                      AND DATE(follow_up_date) = CURDATE()
                      AND status NOT IN (
                          'Completed',
                          'Not Interested'
                      )
                    `,
                    [employeeId]
                );


            const todayFollowups = Number(todayFollowupsRows[0].total) || 0;


            /*--- Missed follow-ups ---*/
            const [missedRows] = await db.execute(
                    `
                    SELECT
                        COUNT(*) AS total
                    FROM follow_ups
                    WHERE counsellor_id = ?
                      AND (
                            DATE(follow_up_date) < CURDATE()
                            OR (
                                DATE(follow_up_date) = CURDATE()
                                AND follow_up_time < CURTIME()
                            )
                          )
                      AND status NOT IN (
                          'Completed',
                          'Not Interested'
                      )
                    `,
                    [employeeId]
                );


            const missedFollowups = Number(missedRows[0].total) || 0;


            /*--- Upcoming follow-ups ---*/
            const [upcomingRows] =
                await db.execute(
                    `
                    SELECT
                        COUNT(*) AS total
                    FROM follow_ups
                    WHERE counsellor_id = ?
                      AND DATE(follow_up_date) > CURDATE()
                      AND status NOT IN (
                          'Completed',
                          'Not Interested'
                      )
                    `,
                    [employeeId]
                );


            const upcomingFollowups = Number(upcomingRows[0].total) || 0;


            /*--- New enquiries ---*/
            const [newEnquiryRows] = await db.execute(
                    `
                    SELECT
                        COUNT(*) AS total
                    FROM student_enquiries
                    WHERE counsellor_id = ?
                      AND DATE(enquiry_date) = CURDATE()
                    `,
                    [employeeId]
                );


            const newEnquiries = Number(newEnquiryRows[0].total) || 0;


            /*--- Today's admissions ---*/
            const [admissionRows] = await db.execute(
                    `
                    SELECT
                        COUNT(*) AS total
                    FROM admissions
                    WHERE counsellor_id = ?
                      AND (
                            DATE(created_at) = CURDATE()
                            OR DATE(joining_date) = CURDATE()
                          )
                    `,
                    [employeeId]
                );


            const admissionsToday = Number(admissionRows[0].total) || 0;


            /*--- Notification list ---*/
            const notifications = [];


            /*--- Today's Follow-ups ---*/
            if (todayFollowups > 0) {

                notifications.push({

                    type: "follow-up",
                    title: "Today's Follow-ups",
                    message: `You have ${todayFollowups} follow-up(s) scheduled today.`,
                    time_text: "Today",
                    link: "my-follow-ups.html"

                });

            }


            /*--- Missed Follow-ups ---*/
            if (missedFollowups > 0) {

                notifications.push({

                    type: "missed-follow-up",
                    title: "Missed Follow-ups",
                    message: `You have ${missedFollowups} missed follow-up(s) requiring attention.`,
                    time_text: "Needs attention",
                    link: "my-follow-ups.html"

                });

            }


            /*--- Upcoming Follow-ups ---*/
            if (upcomingFollowups > 0) {

                notifications.push({

                    type: "upcoming-follow-up",
                    title: "Upcoming Follow-ups",
                    message: `You have ${upcomingFollowups} upcoming follow-up(s).`,
                    time_text: "Upcoming",
                    link: "my-follow-ups.html"

                });

            }


            /*--- New Enquiries ---*/
            if (newEnquiries > 0) {

                notifications.push({

                    type: "enquiry",
                    title: "New Enquiry Activity",
                    message: `${newEnquiries} student enquiry/enquiries were created today.`,
                    time_text: "Today",
                    link: "my-enquiries.html"

                });

            }


            /*--- Admissions ---*/
            if (admissionsToday > 0) {

                notifications.push({

                    type: "admission",
                    title: "Admission Activity",
                    message: `${admissionsToday} admission(s) were recorded today.`,
                    time_text: "Today",
                    link: "my-admissions.html"

                });

            }


            /*--- Summary ---*/
            const totalNotifications = notifications.length;


            /*--- Response ---*/
            res.json({

                success: true,
                employee: {

                    id: employee.id,
                    full_name: employee.full_name,
                    role: employee.role

                },

                summary: {

                    total_notifications: totalNotifications,
                    today_followups: todayFollowups,
                    missed_followups: missedFollowups,
                    upcoming_followups: upcomingFollowups,
                    new_enquiries: newEnquiries,
                    admissions_today: admissionsToday

                },

                notifications

            });

        } catch (error) {

            console.error(
                "❌ Employee Notifications Error:",
                error
            );

            res.status(500).json({

                success: false,
                message: "Failed to load employee notifications.",
                error: error.message

            });

        }

    }
);





/*==== Employee Profile  - Get Method ====*/
app.get("/api/employee/profile", authenticateToken, async (req, res) => {

    try {

        const employeeId = req.user.id;
        const employeeRole = req.user.role;

        /*-- Employee only --*/
        if (
            employeeRole !== "Counsellor" &&
            employeeRole !== "Staff"
        ) {

            return res.status(403).json({
                success: false,
                message: "Access denied. Employee profile only."
            });

        }

        const [employees] = await db.execute(`
            SELECT
                id, full_name, email, mobile, username, role, status, department, joining_date, address, created_at, updated_at
            FROM add_users
            WHERE id = ?
            LIMIT 1
        `, [employeeId]);


        if (!employees.length) {

            return res.status(404).json({
                success: false,
                message: "Employee account not found."
            });

        }

        const employee = employees[0];

        if (employee.status !== "Active") {

            return res.status(403).json({
                success: false,
                message: "Your account is inactive."
            });

        }

        res.json({
            success: true,
            employee
        });

    } catch (error) {

        console.error(
            "❌ Employee Profile Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to load employee profile.",
            error: error.message
        });

    }

});





/*==== Employee Profile  - Put Method ====*/
app.put("/api/employee/profile", authenticateToken, async (req, res) => {

    try {

        const employeeId = req.user.id;
        const employeeRole = req.user.role;

        const {
            full_name, email, mobile, department, address
        } = req.body;


        /*-- Employee only --*/
        if (
            employeeRole !== "Counsellor" &&
            employeeRole !== "Staff"
        ) {

            return res.status(403).json({
                success: false,
                message: "Access denied. Employee profile only."
            });

        }


        /*-- Required fields --*/
        if (
            !full_name ||
            !email ||
            !mobile
        ) {

            return res.status(400).json({
                success: false,
                message: "Full name, email and mobile number are required."
            });

        }


        /*-- Mobile validation --*/
        if (!/^\d{10}$/.test(mobile)) {

            return res.status(400).json({
                success: false,
                message: "Mobile number must be exactly 10 digits."
            });

        }


        /*-- Check account --*/
        const [employees] = await db.execute(`
            SELECT id, status
            FROM add_users
            WHERE id = ?
            LIMIT 1
        `, [employeeId]);


        if (!employees.length) {

            return res.status(404).json({
                success: false,
                message: "Employee account not found."
            });

        }


        if (employees[0].status !== "Active") {

            return res.status(403).json({
                success: false,
                message: "Your account is inactive."
            });

        }


        /*-- Check whether email belongs to another user --*/
        const [existingEmail] = await db.execute(`
            SELECT id
            FROM add_users
            WHERE email = ?
              AND id != ?
            LIMIT 1
        `, [email, employeeId]);

        if (existingEmail.length) {

            return res.status(409).json({
                success: false,
                message: "This email address is already used by another account."
            });

        }


        /*-- Update --*/
        await db.execute(`
            UPDATE add_users
            SET
                full_name = ?,
                email = ?,
                mobile = ?,
                department = ?,
                address = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            full_name,
            email,
            mobile,
            department || null,
            address || null,
            employeeId
        ]);


        res.json({
            success: true,
            message: "Profile updated successfully."
        });


    } catch (error) {

        console.error(
            "❌ Update Employee Profile Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to update employee profile.",
            error: error.message
        });

    }

});





/*==== Employee Profile  -  Put Method / Change Password ====*/
app.put("/api/employee/change-password", authenticateToken, async (req, res) => {

    try {

        const employeeId = req.user.id;
        const employeeRole = req.user.role;

        const {
            currentPassword,
            newPassword,
            confirmPassword
        } = req.body;


        /*-- Employee only --*/
        if (
            employeeRole !== "Counsellor" &&
            employeeRole !== "Staff"
        ) {

            return res.status(403).json({
                success: false,
                message: "Access denied. Employee password change only."
            });

        }


        /*-- Required fields --*/
        if (
            !currentPassword ||
            !newPassword ||
            !confirmPassword
        ) {

            return res.status(400).json({
                success: false,
                message: "Current password, new password and confirmation are required."
            });

        }


        /*-- Minimum password length --*/
        if (newPassword.length < 6) {

            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters."
            });

        }


        /*-- Password match --*/
        if (newPassword !== confirmPassword) {

            return res.status(400).json({
                success: false,
                message: "New password and confirm password do not match."
            });

        }


        /*-- Get current password --*/
        const [employees] = await db.execute(`
            SELECT
                id, password, status
            FROM add_users
            WHERE id = ?
            LIMIT 1
        `, [employeeId]);


        if (!employees.length) {

            return res.status(404).json({
                success: false,
                message: "Employee account not found."
            });

        }

        const employee = employees[0];

        if (employee.status !== "Active") {

            return res.status(403).json({
                success: false,
                message: "Your account is inactive."
            });

        }

        /*-- Compare old password --*/
        const passwordMatch =
            await bcrypt.compare(
                currentPassword,
                employee.password
            );


        if (!passwordMatch) {

            return res.status(401).json({
                success: false,
                message: "Current password is incorrect."
            });

        }

        /*-- Prevent same password --*/
        const samePassword = await bcrypt.compare(
                newPassword,
                employee.password
            );


        if (samePassword) {

            return res.status(400).json({
                success: false,
                message: "New password must be different from the current password."
            });

        }


        /*-- Hash new password --*/
        const hashedPassword = await bcrypt.hash(
                newPassword,
                10
            );


        /*-- Update password --*/
        await db.execute(`
            UPDATE add_users
            SET
                password = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            hashedPassword,
            employeeId
        ]);


        res.json({
            success: true,
            message: "Password changed successfully. Please login again."
        });


    } catch (error) {

        console.error(
            "❌ Employee Change Password Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to change password.",
            error: error.message
        });

    }

});





/*==== GET: Load courses for employee admission form ====*/ 
app.get("/api/employee/admissions/courses", authenticateToken, async (req, res) => {
    try {
        const role = String(req.user?.role || "").toLowerCase();

        if (!["counsellor", "staff"].includes(role)) {
            return res.status(403).json({
                success: false,
                message: "Access denied."
            });
        }

        const [courses] = await db.execute(`
            SELECT id, course_name, course_category, course_fee
            FROM courses
            WHERE status = 'Active'
            ORDER BY course_name
        `);

        res.json({ success: true, courses });

    } catch (error) {
        console.error("Employee courses error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load courses."
        });
    }
});





/*==== Employee View & Edit Admission  - Get Method ====*/
app.get("/api/employee/admissions/:id", authenticateToken, async (req, res) => {
    try {
        const role = String(req.user?.role || "").toLowerCase();
        const employeeId = Number(req.user?.id ?? req.user?.user_id);
        const admissionId = Number(req.params.id);

        if (!["counsellor", "staff"].includes(role)) {
            return res.status(403).json({
                success: false,
                message: "Access denied."
            });
        }

        if (
            !Number.isInteger(admissionId) || admissionId < 1 ||
            !Number.isInteger(employeeId) || employeeId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid admission or employee ID."
            });
        }

        /*-- Your table stores course and counsellor as names. --*/
        const [rows] = await db.execute(
            `SELECT *
             FROM admissions
             WHERE id = ?
               AND counsellor_id = ?
             LIMIT 1`,
            [admissionId, employeeId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Admission not found or not assigned to you."
            });
        }

        return res.json({
            success: true,
            admission: rows[0]
        });

    } catch (error) {
        console.error("GET EMPLOYEE ADMISSION ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve admission."
        });
    }
});





/*==== PUT: Update an existing employee admission ====*/
app.put("/api/employee/admissions/:id", authenticateToken, async (req, res) => {
    try {
        const role = String(req.user?.role || "").toLowerCase();
        const employeeId = Number(req.user?.id ?? req.user?.user_id);
        const admissionId = Number(req.params.id);

        /*--- 1. Check employee permissions ---*/
        if (!["counsellor", "staff"].includes(role)) {
            return res.status(403).json({
                success: false,
                message: "Access denied."
            });
        }

        if (
            !Number.isInteger(admissionId) || admissionId < 1 ||
            !Number.isInteger(employeeId) || employeeId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid admission or employee ID."
            });
        }

        /*--- 2. Read the fields sent by the frontend ---*/
        const {
            student_name, mobile, email, gender, date_of_birth, course_id, batch, joining_date, payment_mode,
            admission_status, course_fee, discount, registration_amount, remarks
        } = req.body;

        const name = String(student_name || "").trim();
        const phone = String(mobile || "").trim();
        const selectedCourseId = Number(course_id);

        const fee = Number(course_fee);
        const discountAmount = Number(discount ?? 0);
        const registration = Number(registration_amount ?? 0);

        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: "Student name and mobile are required."
            });
        }

        if (!/^\d{10}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Mobile number must contain exactly 10 digits."
            });
        }

        if (
            !Number.isInteger(selectedCourseId) ||
            selectedCourseId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid course."
            });
        }

        if (
            ![fee, discountAmount, registration].every(Number.isFinite) ||
            fee < 0 ||
            discountAmount < 0 ||
            registration < 0 ||
            discountAmount > fee ||
            registration > fee - discountAmount
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid course fee, discount or registration amount."
            });
        }

        const allowedStatuses = ["Confirmed", "Pending", "Cancelled"];
        const status = String(admission_status || "Pending");

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid admission status."
            });
        }

        /*--- 3. Validate dates ---*/
        function validDate(value) {
            if (!value) return null;

            const s = String(value);

            if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                return undefined;
            }

            const date = new Date(`${s}T00:00:00.000Z`);

            return !Number.isNaN(date.getTime()) &&
                date.toISOString().slice(0, 10) === s
                ? s
                : undefined;
        }

        const dob = validDate(date_of_birth);
        const joiningDate = validDate(joining_date);

        if (dob === undefined || joiningDate === undefined) {
            return res.status(400).json({
                success: false,
                message: "Invalid date of birth or joining date."
            });
        }

        /*--- 4. Calculate fees on the server ---*/
        const finalFee = Number((fee - discountAmount).toFixed(2));
        const balance = Number((finalFee - registration).toFixed(2));

        /*--- 5. Check that this admission belongs to this employee ---*/
        const [existing] = await db.execute(
            `SELECT id
             FROM admissions
             WHERE id = ? AND counsellor_id = ?
             LIMIT 1`,
            [admissionId, employeeId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Admission not found or not assigned to you."
            });
        }

        /*--- 6. Get the course NAME using the selected course ID. ---*/
        const [courseRows] = await db.execute(
            `SELECT id, course_name
             FROM courses
             WHERE id = ?
             LIMIT 1`,
            [selectedCourseId]
        );

        if (courseRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Selected course does not exist."
            });
        }

        const courseName = courseRows[0].course_name;

        /*--- 7. Update the admission using the correct database columns ---*/
        const [result] = await db.execute(
            `UPDATE admissions SET
                student_name = ?, mobile = ?, email = ?, gender = ?, date_of_birth = ?, course = ?, batch = ?, joining_date = ?,
                payment_mode = ?, admission_status = ?, course_fee = ?, discount = ?, final_fee = ?, registration_amount = ?,
                balance_amount = ?, remarks = ?
             WHERE id = ? AND counsellor_id = ?`,
            [
                name,
                phone,
                email || null,
                gender || null,
                dob,
                courseName,
                batch || null,
                joiningDate,
                payment_mode || null,
                status,
                fee,
                discountAmount,
                finalFee,
                registration,
                balance,
                remarks || null,
                admissionId,
                employeeId
            ]
        );

        return res.json({
            success: true,
            message: "Admission updated successfully.",
            admission_id: admissionId,
            affectedRows: result.affectedRows
        });

    } catch (error) {
        console.error("UPDATE EMPLOYEE ADMISSION ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update admission.",
            ...(process.env.NODE_ENV !== "production"
                ? { error: error.message }
                : {})
        });
    }
});





/*==== EMPLOYEE: VIEW ONE ENQUIRY  -  GET /api/employee/enquiries/:id ====*/
app.get("/api/employee/enquiries/:id", authenticateToken,
    async (req, res) => {
        try {
            const role = String(req.user?.role || "").toLowerCase();
            const employeeId = Number(req.user?.id ?? req.user?.user_id);
            const enquiryId = Number(req.params.id);

            if (!["counsellor", "staff"].includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied."
                });
            }

            if (
                !Number.isInteger(employeeId) || employeeId < 1 ||
                !Number.isInteger(enquiryId) || enquiryId < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid employee or enquiry ID."
                });
            }

            const [rows] = await db.execute(
                `SELECT
                    id, student_name, mobile, email, gender, date_of_birth, course_interested, enquiry_source, counsellor,
                    counsellor_id, enquiry_date, follow_up_date, follow_up_time, status, address, comments, created_at, updated_at
                 FROM student_enquiries
                 WHERE id = ? AND counsellor_id = ?
                 LIMIT 1`,
                [enquiryId, employeeId]
            );

            if (!rows.length) {
                return res.status(404).json({
                    success: false,
                    message: "Enquiry not found or not assigned to you."
                });
            }

            return res.json({
                success: true,
                enquiry: rows[0]
            });
        } catch (error) {
            console.error("EMPLOYEE VIEW ENQUIRY ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load enquiry."
            });
        }
    }
);





/*==== EMPLOYEE: UPDATE ONE ENQUIRY  -  PUT /api/employee/enquiries/:id ====*/
app.put("/api/employee/enquiries/:id", authenticateToken,
    async (req, res) => {
        try {
            const role = String(req.user?.role || "").toLowerCase();
            const employeeId = Number(req.user?.id ?? req.user?.user_id);
            const enquiryId = Number(req.params.id);

            if (!["counsellor", "staff"].includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied."
                });
            }

            if (
                !Number.isInteger(employeeId) || employeeId < 1 ||
                !Number.isInteger(enquiryId) || enquiryId < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid employee or enquiry ID."
                });
            }

            const {
                student_name, mobile, email, gender, date_of_birth, course_interested, enquiry_source, enquiry_date,
                follow_up_date, follow_up_time, status, address, comments
            } = req.body;

            const name = String(student_name || "").trim();
            const phone = String(mobile || "").trim();
            const course = String(course_interested || "").trim();

            if (!name || !phone || !course) {
                return res.status(400).json({
                    success: false,
                    message: "Student name, mobile and course are required."
                });
            }

            if (!/^\d{10}$/.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: "Mobile number must contain exactly 10 digits."
                });
            }

            const validDate = value => {
                if (value === undefined || value === null || value === "") {
                    return null;
                }

                const dateString = String(value);

                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                    return undefined;
                }

                const date = new Date(`${dateString}T00:00:00.000Z`);

                return !Number.isNaN(date.getTime()) &&
                    date.toISOString().slice(0, 10) === dateString
                    ? dateString
                    : undefined;
            };

            const dob = validDate(date_of_birth);
            const enquiryDate = validDate(enquiry_date);
            const followUpDate = validDate(follow_up_date);

            if (
                dob === undefined ||
                enquiryDate === undefined ||
                followUpDate === undefined
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter valid dates."
                });
            }

            let followUpTime = null;

            if (follow_up_time) {
                followUpTime = String(follow_up_time);

                if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(followUpTime)) {
                    return res.status(400).json({
                        success: false,
                        message: "Please enter a valid follow-up time."
                    });
                }

                if (followUpTime.length === 5) {
                    followUpTime += ":00";
                }
            }

            const allowedStatuses = [
                "New", "Pending", "Interested", "Not Interested", "Call Back", "Follow-up", "Admission Confirmed"
            ];

            const enquiryStatus = String(status || "New").trim();

            if (!allowedStatuses.includes(enquiryStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid enquiry status."
                });
            }

            /*-- Verify that this enquiry belongs to the logged-in employee. --*/
            const [existing] = await db.execute(
                `SELECT id
                 FROM student_enquiries
                 WHERE id = ? AND counsellor_id = ?
                 LIMIT 1`,
                [enquiryId, employeeId]
            );

            if (!existing.length) {
                return res.status(404).json({
                    success: false,
                    message: "Enquiry not found or not assigned to you."
                });
            }

            /*-- Do not allow the employee to change counsellor_id or ownership. --*/
            const [result] = await db.execute(
                `UPDATE student_enquiries SET
                    student_name = ?,
                    mobile = ?,
                    email = ?,
                    gender = ?,
                    date_of_birth = ?,
                    course_interested = ?,
                    enquiry_source = ?,
                    enquiry_date = ?,
                    follow_up_date = ?,
                    follow_up_time = ?,
                    status = ?,
                    address = ?,
                    comments = ?,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND counsellor_id = ?`,
                [
                    name,
                    phone,
                    email ? String(email).trim() : null,
                    gender || null,
                    dob,
                    course,
                    enquiry_source || null,
                    enquiryDate,
                    followUpDate,
                    followUpTime,
                    enquiryStatus,
                    address || null,
                    comments || null,
                    enquiryId,
                    employeeId
                ]
            );

            return res.json({
                success: true,
                message: "Enquiry updated successfully.",
                enquiry_id: enquiryId,
                affectedRows: result.affectedRows
            });
        } catch (error) {
            console.error("EMPLOYEE UPDATE ENQUIRY ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to update enquiry.",
                ...(process.env.NODE_ENV !== "production"
                    ? { error: error.message }
                    : {})
            });
        }
    }
);





/*==== EMPLOYEE: VIEW ONE FOLLOW-UP  -  GET /api/employee/follow-ups/:id ====*/
app.get("/api/employee/follow-ups/:id", authenticateToken, async (req, res) => {
        try {

            const role = String(req.user?.role || "").toLowerCase();
            const employeeId = Number(req.user?.id ?? req.user?.user_id);
            const followUpId = Number(req.params.id);

            if (!["counsellor", "staff"].includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied."
                });
            }

            if (
                !Number.isInteger(employeeId) || employeeId < 1 ||
                !Number.isInteger(followUpId) || followUpId < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid employee or follow-up ID."
                });
            }

            const [rows] = await db.execute(
                `SELECT *
                 FROM follow_ups
                 WHERE id = ? AND counsellor_id = ?
                 LIMIT 1`,
                [followUpId, employeeId]
            );

            if (!rows.length) {
                return res.status(404).json({
                    success: false,
                    message: "Follow-up not found or not assigned to you."
                });
            }

            return res.json({
                success: true,
                followUp: rows[0]
            });

        } catch (error) {
            console.error("EMPLOYEE VIEW FOLLOW-UP ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load follow-up."
            });
        }
    }
);





/*==== EMPLOYEE: UPDATE ONE FOLLOW-UP  -  PUT /api/employee/follow-ups/:id ====*/
app.put("/api/employee/follow-ups/:id", authenticateToken, async (req, res) => {

        try {
            const role = String(req.user?.role || "").toLowerCase();
            const employeeId = Number(req.user?.id ?? req.user?.user_id);
            const followUpId = Number(req.params.id);

            if (!["counsellor", "staff"].includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied."
                });
            }

            if (
                !Number.isInteger(employeeId) || employeeId < 1 ||
                !Number.isInteger(followUpId) || followUpId < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid employee or follow-up ID."
                });
            }

            const {
                follow_up_date, follow_up_time, follow_up_type, status, next_follow_up_date, next_follow_up_time, comments
            } = req.body;

            const validDate = value => {
                if (value === undefined || value === null || value === "") {
                    return null;
                }

                const s = String(value);

                if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                    return undefined;
                }

                const d = new Date(`${s}T00:00:00.000Z`);

                return !Number.isNaN(d.getTime()) &&
                    d.toISOString().slice(0, 10) === s
                    ? s
                    : undefined;
            };

            const validTime = value => {
                if (value === undefined || value === null || value === "") {
                    return null;
                }

                const s = String(value);

                if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s)) {
                    return undefined;
                }

                return s.length === 5 ? `${s}:00` : s;
            };

            const date = validDate(follow_up_date);
            const nextDate = validDate(next_follow_up_date);
            const time = validTime(follow_up_time);
            const nextTime = validTime(next_follow_up_time);

            if (
                date === undefined ||
                nextDate === undefined ||
                time === undefined ||
                nextTime === undefined
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter valid follow-up dates and times."
                });
            }

            const allowedTypes = [
                "Phone Call", "WhatsApp", "Email", "Walk-in"
            ];

            const allowedStatuses = [
                "Pending", "Scheduled", "Completed", "Missed", "Interested", "Not Interested", "Call Back", "Admission Confirmed"
            ];

            const type = String(follow_up_type || "").trim();
            const followUpStatus = String(status || "").trim();

            if (!allowedTypes.includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid follow-up type."
                });
            }

            if (!allowedStatuses.includes(followUpStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid follow-up status."
                });
            }

            const [existing] = await db.execute(
                `SELECT id
                 FROM follow_ups
                 WHERE id = ? AND counsellor_id = ?
                 LIMIT 1`,
                [followUpId, employeeId]
            );

            if (!existing.length) {
                return res.status(404).json({
                    success: false,
                    message: "Follow-up not found or not assigned to you."
                });
            }

            const [result] = await db.execute(
                `UPDATE follow_ups
                 SET follow_up_date = ?,
                     follow_up_time = ?,
                     follow_up_type = ?,
                     status = ?,
                     next_follow_up_date = ?,
                     next_follow_up_time = ?,
                     comments = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND counsellor_id = ?`,
                [
                    date,
                    time,
                    type,
                    followUpStatus,
                    nextDate,
                    nextTime,
                    comments ? String(comments).trim() : null,
                    followUpId,
                    employeeId
                ]
            );

            return res.json({
                success: true,
                message: "Follow-up updated successfully.",
                follow_up_id: followUpId,
                affectedRows: result.affectedRows
            });
        } catch (error) {
            console.error("EMPLOYEE UPDATE FOLLOW-UP ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to update follow-up.",
                ...(process.env.NODE_ENV !== "production"
                    ? { error: error.message }
                    : {})
            });
        }
    }
);





/*==== Start server ====*/
app.listen(PORT, () => {

    console.log(`CRM Server running on http://localhost:${PORT}`);

});