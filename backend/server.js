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

                sql += `

                    AND e.counsellor = ?

                `;

                params.push(counsellor);

            }


            /*--- STATUS FILTER ---*/
            if (status !== "") {

                sql += `

                    AND f.status = ?

                `;

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





/*==== GET ACTIVE COUNSELLORS ====*/
app.get("/api/admissions/counsellors", async (req, res) => {
  try {

    const [counsellors] = await db.execute(`
      SELECT DISTINCT counsellor AS name
      FROM student_enquiries
      WHERE counsellor IS NOT NULL
        AND TRIM(counsellor) <> ''
      ORDER BY counsellor ASC
    `);

    res.json({
      success: true,
      counsellors: counsellors
    });

  } catch (error) {
    console.error("❌ Counsellors Error:", error);

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














/*==== Start server ====*/
app.listen(PORT, () => {

    console.log(`CRM Server running on http://localhost:${PORT}`);

});