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





/*==== Start server ====*/
app.listen(PORT, () => {

    console.log(`CRM Server running on http://localhost:${PORT}`);

});