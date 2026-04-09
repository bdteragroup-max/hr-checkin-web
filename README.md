# 🌌 TERA HR Check-in Ecosystem

A premium, state-of-the-art **Human Resources & Employee Management System** engineered for the modern mobile-first workforce. Built with **Next.js**, it seamlessly integrates precision attendance tracking, multi-branch operations, and automated payroll workflows with the **LINE Messaging Ecosystem**.

---

## ✨ System Highlights

### 📍 Precision Check-in Ecosystem
*   **Location-Aware Intelligence**: Triple-mode check-in (Standard Branch, Project Site, and flexible Offsite).
*   **Advanced Watermarking**: Dynamic photo capture with real-time GPS coordinates, timestamping, and smart "In/Out" status indicators.
*   **Geofencing**: Branch-specific distance validation ensuring employees are actually on-site.

### 🍱 Comprehensive Benefit Modules
*   **🚗 Car Borrowing**: Integrated logistics for requesting and managing company vehicle usage.
*   **🎂 Birthday Claims**: Automated celebration benefits including cash gifts and meal allowance requests.
*   **✈️ Travel & Offsite**: End-to-end workflow for travel logs (`trip-log`), accommodation claims, and daily allowances.
*   **💰 Smart OT & Leave**: High-precision request and approval workflows for Overtime and Leave (Business, Sick, Annual).

### 💬 LINE Integration (The Communication Hub)
*   **Flex Messages 2.0**: Beautifully formatted multi-photo reports sent directly to LINE groups.
*   **Auto-Reporting**: Real-time notifications for every check-in, OT request, and leave approval.
*   **Interactive Sharing**: "Share-to-LINE" gated workflows ensure transparency and group awareness.

---

## 🎨 Design Philosophy
The system follows a **Premium Modern Aesthetic**:
*   **Glassmorphism & Gradients**: Sleek, translucent UI elements with smooth color transitions.
*   **Micro-animations**: Interactive hover effects and state transitions for a responsive "alive" feel.
*   **Tailored Color Palettes**: Semantic color coding (Soft Green for Presence, Vibrant Orange for Check-out, Royal Purple for OT).

---

## 🛠️ Technical Architecture

### Core Stack
*   **Framework**: Next.js 14+ (App Router)
*   **Language**: TypeScript (Strict Mode)
*   **ORM**: Prisma with PostgreSQL
*   **Styling**: Vanilla CSS Modules (Optimized for performance & custom aesthetics)
*   **External APIs**: LINE Messaging API (Flex Messages, OG Image Generation)

### 📁 Project Structure
```bash
/src
  /app
    /admin            # Management Dashboard & Reports
    /app              # Employee Mobile Dashboard
    /project-checkin  # Site-specific work logging
    /offsite-checkin  # Remote work & Coffee shop logging
    /car-borrow       # Vehicle log management
    /share            # Edge-runtime OG Image handlers for LINE
    /api              # Robust REST API layer
  /utils              # GIS, Time formatting, and Canvas Watermarking logic
  /lib                # Prisma Client & Security Middleware
```

---

## 🚀 Getting Started

### Prerequisites
*   Node.js 18.x or higher
*   PostgreSQL instance
*   LINE Developers Account (Channel Access Token & Secret)

### Quick Start
1.  **Clone & Install**:
    ```bash
    npm install
    ```
2.  **Environment Sync**: Create a `.env` file mapping your database and LINE credentials.
3.  **Database Sync**:
    ```bash
    npx prisma db push
    ```
4.  **Dev Mode**:
    ```bash
    npm run dev
    ```

---

## 🔐 Security & Governance
*   **Dual-Token Authentication**: Separate secure contexts for standard Users and privileged Administrators.
*   **Edge Guards**: Navigation protection and state-aware forms to prevent data loss.
*   **Encrypted Payloads**: Secure handling of sensitive employee PINs and identity data.

---
> [!IMPORTANT]
> **Aesthetically Driven**: This system is designed to provide a "Wow" factor on first use, prioritizing visual excellence alongside functional accuracy.

© 2026 TERA GROUP HR Solutions. All rights reserved.
