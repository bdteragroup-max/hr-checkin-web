# TERA HR Check-in Web

A comprehensive Human Resources and Employee Management system built with Next.js, handling everything from daily attendance to complex payroll calculations.

## 🚀 Key Features

### Employee Attendance & Check-in
- **Distance-Based Check-in**: Geographic-aware check-in system for office and project sites.
- **Photo Verification**: Real-time photo capture for attendance validation.
- **Dashboard**: Live monitoring of present, late, absent, and on-leave employees.

### Payroll & Allowances
- **Automated Calculation**: Seamlessly calculates base salary, OT, and various allowances.
- **Allowance Types**:
  - **Diligence Allowance** (เบี้ยขยัน): Automated based on attendance records.
  - **Meal Allowance**: Per-day or fixed meal support.
  - **Travel & Off-Site Claims**: Integrated workflow for travel expenses and accommodation.
  - **Telephone Allowance**: Configurable per-employee.
  - **Position Allowance** (เงินประจำตำแหน่ง): Variable role-based allowances.
  - **Birthday Benefits**: Monthly cash gift and meal allowance submission system.

### Management & Workflows
- **Leave Management**: Support for multiple leave types with specific entitlements (Annual, Sick, Personal, etc.).
- **OT Management**: Request and approval workflow for overtime work.
- **Employee Admin**: Centralized management of employee profiles, branches, departments, and payroll settings.
- **Administrative Tools**: Export functionality for payroll and reports.

## 🛠️ Tech Stack
- **Framework**: [Next.js](https://nextjs.org) (App Router)
- **Database**: [PostgreSQL](https://www.postgresql.org/) via [Prisma ORM](https://www.prisma.io/)
- **Authentication**: JWT-based security with separate User and Admin tokens.
- **Styling**: Vanilla CSS Modules for premium, responsive UI.
- **Form Handling**: Multi-part form data support for file uploads (Receipts, Slips, Photos).

## 📁 Project Structure
- `/src/app`: Application routes and UI components.
  - `/src/app/admin`: Administrative dashboard and management pages.
  - `/src/app/api`: Server-side API endpoints (Protected by `requireAdmin` or user tokens).
  - `/src/app/app`: Main employee-facing dashboard and features.
- `/src/lib`: Core utility functions (Prisma client, JWT handling, Auth guards).
- `/src/components`: Shared React components (e.g., `AlertModal`, `Sidebar`).
- `/public/uploads`: File system storage for uploaded evidence (Photos, Slips).
- `/prisma`: Database schema definition and migrations.

## 🛠️ Getting Started

### Prerequisites
- Node.js (Latest LTS recommended)
- PostgreSQL Database
- `.env` file with `DATABASE_URL` and `JWT_SECRET`

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
4. Push schema to database:
   ```bash
   npx prisma db push
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```

## 🔒 Security
The application uses a dual-token system:
- `token`: Used for employee-level access.
- `admin_token`: Used for administrative functions.
API routes use the `requireAdmin()` utility to enforce strict authorization for management endpoints.
