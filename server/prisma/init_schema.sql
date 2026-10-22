-- =============================================================================
-- Quaders School Management System - Master Database Schema Initialization
-- Compatible with PostgreSQL (Railway, Supabase, Neon, AWS RDS, Localhost)
-- All statements are idempotent (safe to run multiple times without data loss)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUMS (Custom PostgreSQL Types)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE "SchoolStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STAFF', 'PARENT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ExaminationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FINALIZED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "AssessmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'LOCKED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReportCardStatus" AS ENUM ('PUBLISHED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2. CORE MULTI-TENANT TABLES
-- -----------------------------------------------------------------------------

-- School (Tenants)
CREATE TABLE IF NOT EXISTS "School" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" "SchoolStatus" NOT NULL DEFAULT 'PENDING',
    "setupCompleted" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT,
    "board" TEXT,
    "phone" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- StaffRole (Custom RBAC Roles)
CREATE TABLE IF NOT EXISTS "StaffRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystemRole" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User (SuperAdmin, Admin, Staff, Parent accounts)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "employeeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "role" "Role" NOT NULL DEFAULT 'PARENT',
    "staffRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AcademicYear (School calendar sessions)
CREATE TABLE IF NOT EXISTS "AcademicYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Class (Grades / Standards)
CREATE TABLE IF NOT EXISTS "Class" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Section (Class subdivisions e.g. A, B, C)
CREATE TABLE IF NOT EXISTS "Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subject (Courses / Subjects)
CREATE TABLE IF NOT EXISTS "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ClassAssignment (Staff assignments to class, section, subject)
CREATE TABLE IF NOT EXISTS "ClassAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "subjectId" TEXT,
    "isClassTeacher" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Parent (Parent/Guardian profiles)
CREATE TABLE IF NOT EXISTS "Parent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT UNIQUE,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "relation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Student (Student enrollments)
CREATE TABLE IF NOT EXISTS "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "rollNo" TEXT,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ParentStudent (Link between Parents and Students)
CREATE TABLE IF NOT EXISTS "ParentStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Attendance (Attendance header by session)
CREATE TABLE IF NOT EXISTS "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "markedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AttendanceEntry (Attendance status per student)
CREATE TABLE IF NOT EXISTS "AttendanceEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attendanceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL
);

-- LeaveRequest (Staff and Student leave applications)
CREATE TABLE IF NOT EXISTS "LeaveRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "applicantRole" TEXT NOT NULL,
    "studentId" TEXT,
    "leaveType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "supportingDoc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FeeStructure (Fee categories and amounts)
CREATE TABLE IF NOT EXISTS "FeeStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Invoice (Student fee invoices & payments)
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SchoolDocument (Flexible collection store for timetables, notices, library, transport)
CREATE TABLE IF NOT EXISTS "SchoolDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AiUsage (Daily token/request quotas)
CREATE TABLE IF NOT EXISTS "AiUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "usageDate" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AiAuditLog (Audit log for LLM invocations)
CREATE TABLE IF NOT EXISTS "AiAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "toolsUsed" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "tokensPrompt" INTEGER,
    "tokensCompletion" INTEGER,
    "errorCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AiConversation (Chat sessions)
CREATE TABLE IF NOT EXISTS "AiConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PasswordResetToken (Secure reset tokens)
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SupportTicket (Ticketing system)
CREATE TABLE IF NOT EXISTS "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketNumber" TEXT UNIQUE,
    "schoolId" TEXT,
    "creatorId" TEXT,
    "creatorName" TEXT NOT NULL,
    "creatorEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SupportTicketMessage (Ticket discussion replies)
CREATE TABLE IF NOT EXISTS "SupportTicketMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SupportTicketHistory (Ticket audit lifecycle)
CREATE TABLE IF NOT EXISTS "SupportTicketHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Module (Master catalog of system modules)
CREATE TABLE IF NOT EXISTS "Module" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CORE',
    "description" TEXT,
    "icon" TEXT,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "actions" JSONB NOT NULL DEFAULT '["VIEW"]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SchoolModule (Tenant-level active modules)
CREATE TABLE IF NOT EXISTS "SchoolModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- superadmin (Dedicated Super Administrator credentials table)
CREATE TABLE IF NOT EXISTS "superadmin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Super Administrator',
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- examinations
CREATE TABLE IF NOT EXISTS "examinations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examType" TEXT NOT NULL DEFAULT 'Term',
    "academicYear" TEXT NOT NULL,
    "term" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ExaminationStatus" NOT NULL DEFAULT 'DRAFT',
    "classId" TEXT,
    "sectionId" TEXT,
    "customData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- assessments
CREATE TABLE IF NOT EXISTS "assessments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "examinationId" TEXT,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "title" TEXT NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "passingMarks" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "weightage" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "examDate" TIMESTAMP(3),
    "status" "AssessmentStatus" NOT NULL DEFAULT 'PENDING',
    "components" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- assessment_grades
CREATE TABLE IF NOT EXISTS "assessment_grades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marksObtained" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "isExempt" BOOLEAN NOT NULL DEFAULT false,
    "grade" TEXT,
    "remarks" JSONB,
    "overrideReason" TEXT,
    "overriddenById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- report_card_templates
CREATE TABLE IF NOT EXISTS "report_card_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Standard Report Card',
    "type" TEXT NOT NULL DEFAULT 'CBSE',
    "branding" JSONB,
    "headerConfig" JSONB,
    "signatureBlocks" JSONB,
    "gradingScale" JSONB,
    "customColumns" JSONB,
    "rawHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- report_cards
CREATE TABLE IF NOT EXISTS "report_cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" TEXT,
    "marksBreakdown" JSONB NOT NULL,
    "totalMarksObtained" DOUBLE PRECISION NOT NULL,
    "totalMaxMarks" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "overallGrade" TEXT NOT NULL,
    "attendanceStats" JSONB,
    "status" "ReportCardStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. UNIQUE CONSTRAINTS & COMPOSITE KEYS
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_schoolId_name_key" UNIQUE ("schoolId", "name");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_schoolId_name_key" UNIQUE ("schoolId", "name");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Section" ADD CONSTRAINT "Section_classId_name_key" UNIQUE ("classId", "name");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_parentId_studentId_key" UNIQUE ("parentId", "studentId");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_admissionNo_key" UNIQUE ("schoolId", "admissionNo");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_schoolId_classId_date_session_key" UNIQUE ("schoolId", "classId", "date", "session");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_attendanceId_studentId_key" UNIQUE ("attendanceId", "studentId");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_schoolId_usageDate_key" UNIQUE ("schoolId", "usageDate");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SchoolModule" ADD CONSTRAINT "SchoolModule_schoolId_moduleId_key" UNIQUE ("schoolId", "moduleId");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "assessment_grades" ADD CONSTRAINT "assessment_grades_assessmentId_studentId_key" UNIQUE ("assessmentId", "studentId");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "report_card_templates" ADD CONSTRAINT "report_card_templates_schoolId_type_key" UNIQUE ("schoolId", "type");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_schoolId_studentId_examinationId_key" UNIQUE ("schoolId", "studentId", "examinationId");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 4. PERFORMANCE & TENANT ISOLATION INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "StaffRole_schoolId_idx" ON "StaffRole"("schoolId");
CREATE INDEX IF NOT EXISTS "User_schoolId_idx" ON "User"("schoolId");
CREATE INDEX IF NOT EXISTS "AcademicYear_schoolId_idx" ON "AcademicYear"("schoolId");
CREATE INDEX IF NOT EXISTS "Class_schoolId_idx" ON "Class"("schoolId");
CREATE INDEX IF NOT EXISTS "Class_academicYearId_idx" ON "Class"("academicYearId");
CREATE INDEX IF NOT EXISTS "Section_schoolId_idx" ON "Section"("schoolId");
CREATE INDEX IF NOT EXISTS "Section_classId_idx" ON "Section"("classId");
CREATE INDEX IF NOT EXISTS "Subject_schoolId_idx" ON "Subject"("schoolId");
CREATE INDEX IF NOT EXISTS "Subject_classId_idx" ON "Subject"("classId");
CREATE INDEX IF NOT EXISTS "ClassAssignment_schoolId_idx" ON "ClassAssignment"("schoolId");
CREATE INDEX IF NOT EXISTS "ClassAssignment_staffId_idx" ON "ClassAssignment"("staffId");
CREATE INDEX IF NOT EXISTS "ClassAssignment_classId_idx" ON "ClassAssignment"("classId");
CREATE INDEX IF NOT EXISTS "ClassAssignment_sectionId_idx" ON "ClassAssignment"("sectionId");
CREATE INDEX IF NOT EXISTS "Parent_schoolId_idx" ON "Parent"("schoolId");
CREATE INDEX IF NOT EXISTS "Parent_userId_idx" ON "Parent"("userId");
CREATE INDEX IF NOT EXISTS "ParentStudent_parentId_idx" ON "ParentStudent"("parentId");
CREATE INDEX IF NOT EXISTS "ParentStudent_studentId_idx" ON "ParentStudent"("studentId");
CREATE INDEX IF NOT EXISTS "Student_schoolId_idx" ON "Student"("schoolId");
CREATE INDEX IF NOT EXISTS "Student_classId_idx" ON "Student"("classId");
CREATE INDEX IF NOT EXISTS "Student_sectionId_idx" ON "Student"("sectionId");
CREATE INDEX IF NOT EXISTS "Student_admissionNo_idx" ON "Student"("admissionNo");
CREATE INDEX IF NOT EXISTS "Attendance_schoolId_idx" ON "Attendance"("schoolId");
CREATE INDEX IF NOT EXISTS "Attendance_classId_idx" ON "Attendance"("classId");
CREATE INDEX IF NOT EXISTS "LeaveRequest_schoolId_idx" ON "LeaveRequest"("schoolId");
CREATE INDEX IF NOT EXISTS "LeaveRequest_studentId_idx" ON "LeaveRequest"("studentId");
CREATE INDEX IF NOT EXISTS "LeaveRequest_applicantId_idx" ON "LeaveRequest"("applicantId");
CREATE INDEX IF NOT EXISTS "FeeStructure_schoolId_idx" ON "FeeStructure"("schoolId");
CREATE INDEX IF NOT EXISTS "FeeStructure_classId_idx" ON "FeeStructure"("classId");
CREATE INDEX IF NOT EXISTS "Invoice_schoolId_idx" ON "Invoice"("schoolId");
CREATE INDEX IF NOT EXISTS "Invoice_studentId_idx" ON "Invoice"("studentId");
CREATE INDEX IF NOT EXISTS "Invoice_feeId_idx" ON "Invoice"("feeId");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX IF NOT EXISTS "SchoolDocument_schoolId_collection_idx" ON "SchoolDocument"("schoolId", "collection");
CREATE INDEX IF NOT EXISTS "AiUsage_schoolId_idx" ON "AiUsage"("schoolId");
CREATE INDEX IF NOT EXISTS "AiAuditLog_schoolId_createdAt_idx" ON "AiAuditLog"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiConversation_userId_updatedAt_idx" ON "AiConversation"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "AiConversation_schoolId_idx" ON "AiConversation"("schoolId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "SupportTicket_schoolId_idx" ON "SupportTicket"("schoolId");
CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX IF NOT EXISTS "SupportTicket_priority_idx" ON "SupportTicket"("priority");
CREATE INDEX IF NOT EXISTS "SupportTicket_assignedToId_idx" ON "SupportTicket"("assignedToId");
CREATE INDEX IF NOT EXISTS "SupportTicketMessage_ticketId_idx" ON "SupportTicketMessage"("ticketId");
CREATE INDEX IF NOT EXISTS "SupportTicketHistory_ticketId_idx" ON "SupportTicketHistory"("ticketId");
CREATE INDEX IF NOT EXISTS "SchoolModule_schoolId_idx" ON "SchoolModule"("schoolId");
CREATE INDEX IF NOT EXISTS "SchoolModule_moduleId_idx" ON "SchoolModule"("moduleId");

CREATE INDEX IF NOT EXISTS "examinations_schoolId_idx" ON "examinations"("schoolId");
CREATE INDEX IF NOT EXISTS "examinations_academicYear_idx" ON "examinations"("academicYear");
CREATE INDEX IF NOT EXISTS "examinations_status_idx" ON "examinations"("status");
CREATE INDEX IF NOT EXISTS "examinations_classId_idx" ON "examinations"("classId");

CREATE INDEX IF NOT EXISTS "assessments_schoolId_idx" ON "assessments"("schoolId");
CREATE INDEX IF NOT EXISTS "assessments_examinationId_idx" ON "assessments"("examinationId");
CREATE INDEX IF NOT EXISTS "assessments_classId_idx" ON "assessments"("classId");
CREATE INDEX IF NOT EXISTS "assessments_subjectId_idx" ON "assessments"("subjectId");
CREATE INDEX IF NOT EXISTS "assessments_teacherId_idx" ON "assessments"("teacherId");

CREATE INDEX IF NOT EXISTS "assessment_grades_schoolId_idx" ON "assessment_grades"("schoolId");
CREATE INDEX IF NOT EXISTS "assessment_grades_assessmentId_idx" ON "assessment_grades"("assessmentId");
CREATE INDEX IF NOT EXISTS "assessment_grades_studentId_idx" ON "assessment_grades"("studentId");

CREATE INDEX IF NOT EXISTS "report_card_templates_schoolId_idx" ON "report_card_templates"("schoolId");

CREATE INDEX IF NOT EXISTS "report_cards_schoolId_idx" ON "report_cards"("schoolId");
CREATE INDEX IF NOT EXISTS "report_cards_studentId_idx" ON "report_cards"("studentId");
CREATE INDEX IF NOT EXISTS "report_cards_examinationId_idx" ON "report_cards"("examinationId");

-- -----------------------------------------------------------------------------
-- 5. FOREIGN KEY CONSTRAINTS (Referential Integrity & Cascading Deletions)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "User" ADD CONSTRAINT "User_staffRoleId_fkey" FOREIGN KEY ("staffRoleId") REFERENCES "StaffRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Class" ADD CONSTRAINT "Class_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Section" ADD CONSTRAINT "Section_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Section" ADD CONSTRAINT "Section_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Subject" ADD CONSTRAINT "Subject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Parent" ADD CONSTRAINT "Parent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Parent" ADD CONSTRAINT "Parent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Student" ADD CONSTRAINT "Student_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SchoolDocument" ADD CONSTRAINT "SchoolDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AiAuditLog" ADD CONSTRAINT "AiAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SupportTicketHistory" ADD CONSTRAINT "SupportTicketHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SchoolModule" ADD CONSTRAINT "SchoolModule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SchoolModule" ADD CONSTRAINT "SchoolModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Examination foreign keys
DO $$ BEGIN
    ALTER TABLE "examinations" ADD CONSTRAINT "examinations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "examinations" ADD CONSTRAINT "examinations_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "examinations" ADD CONSTRAINT "examinations_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Assessment foreign keys
DO $$ BEGIN
    ALTER TABLE "assessments" ADD CONSTRAINT "assessments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "assessments" ADD CONSTRAINT "assessments_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "examinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "assessments" ADD CONSTRAINT "assessments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "assessments" ADD CONSTRAINT "assessments_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "assessments" ADD CONSTRAINT "assessments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "assessments" ADD CONSTRAINT "assessments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AssessmentGrade foreign keys
DO $$ BEGIN
    ALTER TABLE "assessment_grades" ADD CONSTRAINT "assessment_grades_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "assessment_grades" ADD CONSTRAINT "assessment_grades_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "assessment_grades" ADD CONSTRAINT "assessment_grades_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "assessment_grades" ADD CONSTRAINT "assessment_grades_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ReportCardTemplate foreign keys
DO $$ BEGIN
    ALTER TABLE "report_card_templates" ADD CONSTRAINT "report_card_templates_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ReportCard foreign keys
DO $$ BEGIN
    ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "examinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 6. SEED DATA - SYSTEM MODULES CATALOG & DEFINITIONS
-- -----------------------------------------------------------------------------
INSERT INTO "Module" ("id", "name", "category", "description", "icon", "isCore", "actions", "updatedAt")
VALUES
  ('classes', 'Classes & Sections', 'CORE', 'Manage class grades, divisions, and section assignments', 'LuLayers', true, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('subjects', 'Subject Management', 'CORE', 'Define curriculum, subjects, codes, and assign subject teachers', 'LuBookOpen', true, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('students', 'Student Directory & Admissions', 'CORE', 'Enroll students, manage student profiles, roll numbers, and admissions', 'LuGraduationCap', true, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('staff', 'Staff Management', 'CORE', 'Manage teaching and non-teaching personnel, roles, and credentials', 'LuUsers', true, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('attendance', 'Attendance Management', 'CORE', 'Mark and track forenoon/afternoon session attendance for classes and students', 'LuCalendarCheck', true, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('timetables', 'Timetables & Scheduling', 'ACADEMIC', 'Class and teacher period scheduling, slot allocations, and conflict checking', 'LuClock', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('calendar', 'Academic Calendar', 'ACADEMIC', 'School terms, exam dates, holidays, events, and academic milestones', 'LuCalendar', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('exams', 'Examinations & Report Cards', 'ACADEMIC', 'Exam scheduling, mark entries, grading rubrics, and automated report cards', 'LuFileSpreadsheet', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('homework', 'Homework & Assignments', 'ACADEMIC', 'Assign homework, track student submissions, and grade assignments', 'LuClipboardList', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('lesson_plans', 'Lesson Plans', 'ACADEMIC', 'Curriculum progression, weekly lesson objectives, and teaching notes', 'LuBookMarked', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('resources', 'Resource Sharing', 'ACADEMIC', 'Digital study material, past papers, notes, and syllabus PDFs', 'LuFolder', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('ptm', 'PTM Scheduler', 'ACADEMIC', 'Parent-Teacher meeting scheduling, time-slot bookings, and minutes', 'LuCalendarRange', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('performance', 'Performance Tracking', 'ACADEMIC', 'Student progress analytics, subject trends, and performance insights', 'LuTrendingUp', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('fees', 'Fees & Payments', 'FINANCE', 'Fee structures, student invoices, online payment processing, and receipts', 'LuCreditCard', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('hr-payroll', 'HR & Payroll', 'FINANCE', 'Staff salary structures, allowances, deductions, payslips, and tax calculations', 'LuWallet', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('leaves', 'Leave Requests', 'ADMINISTRATIVE', 'Staff and student leave applications, approval workflows, and documentation', 'LuUserMinus', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('noticeboard', 'Noticeboard & Announcements', 'COMMUNICATION', 'School-wide circulars, emergency announcements, and targeted student/parent notices', 'LuBell', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('chats', 'Chat & Messaging', 'COMMUNICATION', 'Real-time tenant messaging between teachers, staff, and parents', 'LuMessageSquare', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('complaints', 'Complaint Redressal', 'COMMUNICATION', 'Parent grievance submissions, internal investigations, and resolution tracking', 'LuAlertTriangle', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('library', 'Library Management', 'OPERATIONS', 'Book cataloging, ISBN lookup, issue/return tracking, and overdue fines', 'LuLibrary', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('transport', 'Transport Management', 'OPERATIONS', 'School bus fleet, drivers, routes, passenger lists, and pickup stops', 'LuBus', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('inventory', 'Inventory & Assets', 'OPERATIONS', 'School equipment, lab apparatus, sports gear, stock monitoring, and requests', 'LuPackage', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('canteen', 'Canteen Management', 'OPERATIONS', 'Meal menus, daily nutrition tracking, inventory, and meal passes', 'LuUtensils', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('hostel', 'Hostel Management', 'OPERATIONS', 'Dormitory room allocations, warden tracking, and boarding student records', 'LuHome', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('health', 'Health & Medical Records', 'OPERATIONS', 'Student allergies, emergency doctor contacts, medical checkups, and vaccinations', 'LuHeartPulse', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('leads', 'Leads & Inquiries', 'ADMISSIONS', 'Prospective student inquiries, admission pipeline, and counseling logs', 'LuUserPlus', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('alumni', 'Alumni Network', 'COMMUNITY', 'Graduated batch directory, alumni events, and career mentorship', 'LuAward', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('form-builder', 'Custom Forms', 'ADMINISTRATIVE', 'Dynamic custom forms for surveys, field trips, registrations, and feedback', 'LuFormInput', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('documents', 'Document Management', 'ADMINISTRATIVE', 'School certificates, transfer certificates, verification records, and archives', 'LuFileText', false, '["VIEW", "CREATE", "EDIT", "DELETE"]'::jsonb, CURRENT_TIMESTAMP),
  ('reports', 'Reports & Analytics', 'ANALYTICS', 'Institutional metrics, attendance summaries, fee collection rates, and audit logs', 'LuBarChart3', false, '["VIEW"]'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "isCore" = EXCLUDED."isCore",
  "actions" = EXCLUDED."actions",
  "updatedAt" = CURRENT_TIMESTAMP;

-- -----------------------------------------------------------------------------
-- 7. SEED DATA - SUPER ADMINISTRATOR CREDENTIALS
-- -----------------------------------------------------------------------------
-- Hashed password for 'Quad@1010'
INSERT INTO "superadmin" ("id", "email", "password", "name", "role", "status", "createdAt", "updatedAt")
VALUES (
  'superadmin-primary-001',
  'info.quaders@gmail.com',
  '$2b$10$T8ZzK1P/F6tSkmB9QnB3Ue3.V0p.J4eR4o8QyE3W3G9T2aU7a6tVq',
  'Super Administrator',
  'SUPER_ADMIN',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "User" ("id", "email", "password", "name", "role", "status", "createdAt", "updatedAt")
VALUES (
  'superadmin-primary-001',
  'info.quaders@gmail.com',
  '$2b$10$T8ZzK1P/F6tSkmB9QnB3Ue3.V0p.J4eR4o8QyE3W3G9T2aU7a6tVq',
  'Super Administrator',
  'SUPER_ADMIN',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;

