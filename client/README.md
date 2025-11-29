# Israeli Funds Manager - Frontend

Modern React + TypeScript + Material-UI dashboard for managing Israeli bank accounts and credit cards.

## Features

- **Secure Authentication** - Login/Register with session-based auth
- **Dashboard** - Real-time financial analytics with charts and visualizations
- **Account Management** - Add, edit, and delete bank/credit card accounts
- **Transaction Analytics** - Category breakdown, trends, and recurring payments
- **Application Logs** - Monitor system activity and troubleshoot issues

## Tech Stack

- **React 19** with TypeScript
- **Material-UI (MUI)** - Component library and design system
- **Recharts** - Data visualization and charting
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls
- **date-fns** - Date manipulation utilities
- **Vite** - Build tool and dev server

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend server running on `http://localhost:3000`

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Environment Variables

Create a `.env` file in the root directory:

```
VITE_API_URL=http://localhost:3000
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout/         # MainLayout with sidebar navigation
│   ├── Home/           # Dashboard components (charts, filters)
│   ├── Accounts/       # Account management dialogs
│   └── ProtectedRoute.tsx
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication state management
├── pages/              # Page components
│   ├── Login.tsx       # Authentication page
│   ├── Home.tsx        # Dashboard with analytics
│   ├── Accounts.tsx    # Account management
│   └── Logs.tsx        # Application logs viewer
├── services/           # API clients
│   └── api.ts          # Axios client with auth interceptors
├── types/              # TypeScript type definitions
│   └── index.ts
├── utils/              # Helper functions
│   ├── dateUtils.ts    # Date formatting and filtering
│   └── companyIcons.tsx # Institution icons and names
├── theme.ts            # MUI theme configuration
├── App.tsx             # Root component with routing
└── main.tsx            # Application entry point
```

## Key Features

### Dashboard (Home)
- Net income, cash flow, and expense cards
- Time period filters (last month, 3/6/12 months, custom)
- Pie chart for category distribution
- Line chart for income/expense trends
- Top 5 recurring payments table

### Accounts
- View all configured bank and credit card accounts
- Add new accounts with credentials (securely encrypted)
- Edit account details (alias, active status)
- Delete accounts with confirmation dialog
- Icons differentiate banks vs. credit cards

### Logs
- Real-time application logs
- Filter by log level (info, warn, error, debug)
- Search by message or context
- 3-month log retention

## API Integration

The frontend communicates with the backend via REST API:

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/accounts` - Fetch all accounts
- `POST /api/accounts/:companyId` - Create account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account
- `GET /api/analytics/summary` - Financial summary
- `GET /api/analytics/category-distribution` - Category breakdown
- `GET /api/analytics/trends` - Income/expense trends
- `GET /api/analytics/recurring-payments` - Recurring payments

All authenticated requests include `X-Session-ID` header.

## Design System

The application follows a modern fintech design inspired by RiseUp and Moneytor:

- Clean, card-based layout
- Responsive grid system
- Smooth animations and transitions
- Professional color scheme
- Accessible UI components

## Security

- Session-based authentication
- Credentials encrypted on backend
- Auto-redirect on 401 (unauthorized)
- Protected routes requiring authentication
- Secure password input fields