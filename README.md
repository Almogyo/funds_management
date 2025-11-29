# Israeli Funds Management Application

A comprehensive full-stack application for managing Israeli bank accounts and credit cards with automated transaction scraping, categorization, and analytics.

![Tech Stack](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Material UI](https://img.shields.io/badge/Material--UI-0081CB?style=for-the-badge&logo=material-ui&logoColor=white)

## Features

### Backend
- 🔐 **Secure credential encryption** for bank/credit card credentials
- 🏦 **Multi-institution support** - Israeli banks (Hapoalim, Leumi, Discount, Mizrahi, Union, Massad) and credit cards (VisaCal, Max, Isracard, Amex)
- 🤖 **Automated transaction scraping** using israeli-bank-scrapers
- 📊 **Smart categorization** with keyword matching and learning
- 📈 **Advanced analytics** - recurring payments, trends, category distribution
- 🔒 **Session-based authentication** with secure password hashing
- 📝 **Comprehensive logging** with Winston
- 🔄 **RESTful API** with Swagger/OpenAPI documentation

### Frontend
- 🎨 **Modern fintech UI** inspired by RiseUp and Moneytor
- 📊 **Interactive dashboard** with charts (pie charts, line graphs)
- 🔍 **Time-based filtering** (last month/3/6/12 months, custom dates)
- 🏦 **Account management** with CRUD operations
- 📋 **Application logs viewer** for troubleshooting
- 📱 **Responsive design** for mobile and desktop
- ♿ **Accessible components** using Material-UI

## Architecture

```
├── Backend (Node.js + TypeScript + Express)
│   ├── Authentication & Authorization
│   ├── Credential Encryption Service
│   ├── Transaction Scraping Orchestrator
│   ├── Analytics Engine
│   ├── SQLite Database
│   └── REST API with Swagger
│
└── Frontend (React + TypeScript + Vite + MUI)
    ├── Authentication Context
    ├── Protected Routes
    ├── Dashboard with Charts (Recharts)
    ├── Account Management
    └── Logs Viewer
```

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Israeli bank/credit card credentials** for testing

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd funds_management
```

2. **Install backend dependencies**
```bash
npm install
```

3. **Install frontend dependencies**
```bash
cd client
npm install
cd ..
```

4. **Configure the application**

Create a `config/config.json` file:
```json
{
  "server": {
    "port": 3000,
    "host": "localhost",
    "env": "development"
  },
  "database": {
    "path": "./data/funds_management.db",
    "enableWAL": true,
    "enableForeignKeys": true
  },
  "security": {
    "encryptionKey": "your-32-character-encryption-key",
    "sessionSecret": "your-session-secret-key",
    "sessionMaxAge": 86400000,
    "bcryptRounds": 10,
    "rateLimitWindowMs": 900000,
    "rateLimitMaxRequests": 100
  },
  "scraping": {
    "screenshotPath": "./screenshots",
    "maxConcurrentJobs": 3
  },
  "logging": {
    "level": "info",
    "logsDirectory": "./logs",
    "maxFileSize": 10485760,
    "maxFiles": 7
  }
}
```

5. **Configure frontend environment**

Create `client/.env`:
```
VITE_API_URL=http://localhost:3000
```

### Development

**Run backend:**
```bash
npm run dev
```
Backend will be available at `http://localhost:3000`
Swagger API docs at `http://localhost:3000/api-docs`

**Run frontend (in a separate terminal):**
```bash
cd client
npm run dev
```
Frontend will be available at `http://localhost:5173`

### Production Build

**Build backend:**
```bash
npm run build
npm start
```

**Build frontend:**
```bash
cd client
npm run build
npm run preview
```

## API Documentation

The backend provides comprehensive Swagger/OpenAPI documentation accessible at:
```
http://localhost:3000/api-docs
```

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get session
- `POST /api/auth/logout` - Logout and destroy session
- `POST /api/auth/change-password` - Change user password

#### Accounts
- `GET /api/accounts` - Get all accounts
- `POST /api/accounts/:companyId` - Create new account (dropdown for institution)
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

#### Transactions
- `GET /api/transactions` - Get transactions with filters
- `GET /api/transactions/:id` - Get single transaction
- `PUT /api/transactions/:id/category` - Update transaction category

#### Analytics
- `GET /api/analytics/summary` - Financial summary
- `GET /api/analytics/category-distribution` - Expenses by category
- `GET /api/analytics/trends` - Income/expense trends over time
- `GET /api/analytics/recurring-payments` - Detect recurring payments
- `GET /api/analytics/highest-expense` - Find largest expense

#### Scraping
- `POST /api/scrape` - Initiate transaction scraping for accounts

All authenticated endpoints require `X-Session-ID` header.

## Project Structure

### Backend (`/`)
```
src/
├── config/             # Configuration management and Swagger setup
├── controllers/        # Request handlers for each domain
├── database/           # SQLite database service and migrations
├── middleware/         # Authentication and request middleware
├── repositories/       # Data access layer
├── services/           # Business logic (auth, scraping, analytics, encryption)
├── types/              # TypeScript interfaces and types
├── utils/              # Logging and helper functions
└── app.ts              # Express application setup
```

### Frontend (`/client`)
```
src/
├── components/         # Reusable UI components
│   ├── Layout/        # MainLayout with sidebar
│   ├── Home/          # Dashboard components
│   └── Accounts/      # Account management dialogs
├── contexts/           # React contexts (Auth)
├── pages/              # Page components (Home, Accounts, Logs, Login)
├── services/           # API client with auth interceptors
├── types/              # TypeScript interfaces
├── utils/              # Date formatting, company icons
└── theme.ts            # MUI theme configuration
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: SQLite with better-sqlite3
- **Authentication**: bcrypt + session-based auth
- **Encryption**: crypto (AES-256-CBC)
- **Scraping**: israeli-bank-scrapers
- **Logging**: Winston
- **API Docs**: Swagger (swagger-jsdoc + swagger-ui-express)
- **Validation**: JSON schema validation

### Frontend
- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI) v7
- **Routing**: React Router v7
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Date Utilities**: date-fns
- **State Management**: React Context API

## Security Features

- 🔐 **Credential Encryption**: Bank credentials encrypted with AES-256-CBC using unique salt and IV per entry
- 🔑 **Password Hashing**: bcrypt with configurable rounds
- 🎫 **Session-Based Auth**: Secure sessions with configurable expiry
- 🛡️ **Rate Limiting**: Configurable request rate limiting
- 🔒 **Helmet.js**: Security headers for Express
- ✅ **CORS**: Cross-origin resource sharing configured
- 🚫 **Input Validation**: All inputs validated and sanitized

## Supported Financial Institutions

### Banks
- Bank Hapoalim (הפועלים)
- Bank Leumi (לאומי)
- Discount Bank (דיסקונט)
- Mizrahi Tefahot (מזרחי טפחות)
- Union Bank (יוניון)
- Massad Bank (מסד)

### Credit Cards
- VisaCal (ויזה כאל)
- Max (מקס)
- Isracard (ישראכרט)
- American Express (אמריקן אקספרס)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- [israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers) for scraping functionality
- Material-UI team for the excellent component library
- The TypeScript and React communities

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Note**: This application handles sensitive financial data. Always use strong encryption keys, keep credentials secure, and follow security best practices in production environments.