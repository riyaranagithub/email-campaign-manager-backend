# 📧 EmailPro - Backend (Node.js + Express + Gemini AI)

The REST API backend for **EmailPro**, an AI-powered Email Campaign Manager. Built with Node.js, Express, MongoDB (Mongoose), Google Gemini AI (`@google/genai`), and Nodemailer.

---

## 🌟 Key Features

* **CSV Ingestion & Deduplication**: Stream-parses CSV contact databases, validates email syntax, and filters duplicates before inserting to MongoDB.
* **Google Gemini AI Classification**: Batches contacts (50-100 emails) and invokes `gemini-2.5-flash` via `@google/genai` to automatically classify email addresses into **Business** (enterprise & custom domains) and **Individual** (Gmail, Yahoo, Outlook, etc.). Includes automatic domain heuristic fallback.
* **Campaign Dispatcher**: Dispatches personalized emails with `{name}`, `{email}`, and `{date}` template placeholders and attachments. Supports custom SMTP (Gmail, SendGrid, Resend, Amazon SES) with automatic Ethereal test transport fallback.
* **Audit & Analytics Logging**: Records detailed delivery status (`delivered` / `failed`) for every single recipient with error diagnostics and CSV export capabilities.
* **Zero-Config Dev Mode**: Automatically falls back to an embedded in-memory MongoDB instance (`mongodb-memory-server`) if no external MongoDB server is running.

---

## 🛠️ Tech Stack

* **Runtime**: Node.js (ES Modules)
* **Framework**: Express.js
* **Database**: MongoDB & Mongoose (with `mongodb-memory-server` fallback)
* **AI SDK**: `@google/genai` (`gemini-2.5-flash`)
* **Email Transport**: Nodemailer
* **File & Stream Processing**: Multer, `csv-parser`

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment (`.env`)

Copy `.env.example` to `.env`:

```env
PORT=5000
NODE_ENV=development

# Database Connection (Leave blank for automatic in-memory MongoDB)
MONGO_URI=mongodb://127.0.0.1:27017/emailpro

# Google Gemini API Key (Get from https://aistudio.google.com/)
GEMINI_API_KEY=

# Default SMTP Settings (Optional - can also be configured from the UI Settings page)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SENDER_NAME=EmailPro Campaign Manager
SENDER_EMAIL=
```

### 3. Run the Server

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

The API server will run on **http://localhost:5000**.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/emails/upload` | Upload CSV and deduplicate contacts |
| `GET` | `/api/emails` | List contacts with filtering & pagination |
| `GET` | `/api/emails/stats` | Summary statistics of contacts |
| `DELETE` | `/api/emails/duplicates` | Clean duplicate entries in database |
| `POST` | `/api/classify/run` | Run Gemini AI batch classification |
| `PATCH` | `/api/classify/:id/category` | Manual category override |
| `POST` | `/api/campaigns/launch` | Create and immediately dispatch campaign |
| `GET` | `/api/campaigns` | List all campaigns |
| `GET` | `/api/reports/summary` | Global delivery metrics |
| `GET` | `/api/reports/:id` | Campaign report with audit logs |
| `GET` | `/api/reports/:id/export` | Download campaign logs as CSV |
| `GET` | `/api/settings` | Get current SMTP and AI configuration |
| `POST` | `/api/settings` | Update settings |
| `POST` | `/api/settings/test-smtp` | Verify SMTP connection |
