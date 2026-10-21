# SMS-Quaders (School Management System)

A modern, multi-tenant enterprise School Management System (SMS) & ERP monorepo built for high scale, granular role-based access control (RBAC), and real-time school operations.

---

## 🏛️ System Architecture

This repository is organized as a monorepo consisting of:

- **`client/`**: Modern React single-page application built with Vite, Tailwind CSS, Lucide Icons, and React Router.
- **`server/`**: Scalable Node.js & Express REST API with Prisma ORM, PostgreSQL, Socket.io real-time engine, and multi-tenant collection storage.
- **`bulk_import_templates/`**: Reference CSV/XLSX templates for bulk student, teacher, and class imports.

---

## ✨ Key Features & Portals

### 1. 🛡️ SuperAdmin SaaS Management
- Multi-tenant school lifecycle management (Pending Approval, Active, Suspended).
- Subscription plan tier configuration and license usage monitoring.
- Centralized support ticketing system with threaded messaging and status tracking.
- System-wide audit logs and transactional email templates.

### 2. 🏫 School Admin Portal (Comprehensive ERP)
- **Student Lifecycle**: Online admission reviews, student directory, custom fields builder, and bulk XLSX import/export.
- **Academic Setup**: Class & section management, subject allocation, academic years, and timetable generation.
- **Attendance & Leave Engine**: Twice-daily session-based attendance marking and staff/student leave approvals.
- **Fee Management**: Fee structure templates, automated invoice generation, payment status tracking, and offline receipts.
- **Operations & Logistics**: Inventory tracking with audit logs, transport routes & bus allocations, library management, and canteen tracking.
- **Staff & HR**: Role-based permissions, staff directory, class teacher assignments, and HR/payroll processing.
- **Custom Modules & Form Builder**: Dynamic form builder for public admission links and inquiries.

### 3. 👨‍🏫 Teacher Portal
- Interactive dashboard for daily class schedules and timetables.
- Class roster and session-based student attendance marking.
- Grade entry, exam marks management, and report card generation.
- Homework assignment creation and submission reviews.
- Lesson plan management and leave requests.

### 4. 👨‍👩‍👧 Parent Portal
- Multi-child switcher for parents with multiple enrolled students.
- Live child attendance summaries and academic performance tracking.
- Homework overview, noticeboard updates, and PTM (Parent-Teacher Meeting) scheduler.
- Fee invoices viewing and payment receipt history.
- Direct messaging and communication with teachers.

### 5. 🤖 AI & Communication Hub
- **AI Assistant Widget**: Context-aware assistant integrated into the platform with daily quota tracking and audit logs.
- **Communication Channels**: Integrated email and WhatsApp notification services.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL database
- Git

### 1. Backend Setup
```bash
cd server
npm install

# Copy environment variables
cp .env.example .env
# Configure your DATABASE_URL, JWT_SECRET, etc. in .env

# Generate Prisma Client & Run Migrations
npx prisma generate
npx prisma db push

# Start the server (runs on port 5001 by default)
npm run dev
```

### 2. Frontend Setup
```bash
cd client
npm install

# Copy environment variables
cp .env.example .env

# Start the Vite development server (runs on port 5173 by default)
npm run dev
```

---

## 🔒 Security & Tenant Isolation
- Secure JWT stateless authentication paired with role authorization.
- Strict multi-tenant isolation enforced via server middleware on all data access routes.
- Helmet security headers and CORS protection.

---

## 📄 License
Private & Proprietary. All rights reserved.
