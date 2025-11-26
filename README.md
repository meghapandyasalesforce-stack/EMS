# EMS-Paarsiv - Employee Management System

A comprehensive Employee Management System built with modern web technologies, featuring attendance tracking, payroll management, leave management, and more.

## 🚀 Features

- **Authentication & Authorization**: Secure JWT-based authentication with role-based access control
- **Employee Management**: Complete employee lifecycle management
- **Attendance Tracking**: Real-time attendance monitoring with check-in/check-out
- **Payroll Management**: Automated payroll calculation and management
- **Leave Management**: Leave application and approval workflow
- **Project Management**: Task assignment and project tracking
- **Notifications**: Real-time notifications and push notifications
- **PWA Support**: Progressive Web App with offline capabilities
- **Mobile Support**: Capacitor integration for native mobile apps

## 📋 Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Redux Toolkit** - State management
- **React Router** - Routing (BrowserRouter)
- **Tailwind CSS** - Styling
- **Material-UI** - Component library
- **Chart.js / Recharts** - Data visualization

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Redis** - Caching (optional)
- **BullMQ** - Job queue system
- **i18next** - Internationalization

## 🏗️ Project Structure

```
EMS-Paarsiv/
├── server/                 # Backend application
│   ├── config/            # Configuration files
│   ├── controllers/       # Route controllers
│   ├── db/                # Database configuration
│   ├── helpers/           # Utility functions
│   ├── middlewares/       # Express middlewares
│   ├── models/            # Mongoose models
│   ├── routes/            # API routes
│   └── server.js          # Entry point
│
└── vite_client/           # Frontend application
    ├── src/
    │   ├── Admin/         # Admin components
    │   ├── Employee/      # Employee components
    │   ├── Auth/          # Authentication components
    │   ├── components/    # Reusable components
    │   ├── context/       # Redux store and slices
    │   └── utils/         # Utility functions
    └── vite.config.js     # Vite configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd EMS-Paarsiv
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../vite_client
   npm install
   ```

4. **Configure environment variables**
   
   Copy `server/env.example` to `server/.env` and fill in the required values:
   ```bash
   cd ../server
   cp env.example .env
   ```
   
   Key environment variables:
   - `MONGO_URI` - MongoDB connection string
   - `JWT_SECRET` - Secret key for JWT tokens (min 32 characters)
   - `FRONTEND_URL` - Frontend URL for CORS
   - `EMAIL_USER` / `EMAIL_PASS` - Email credentials for notifications

### Running the Application

1. **Start MongoDB**
   ```bash
   # Make sure MongoDB is running on your system
   mongod
   ```

2. **Start the backend server**
   ```bash
   cd server
   npm run dev
   ```
   Server will run on `http://localhost:5000`

3. **Start the frontend development server**
   ```bash
   cd vite_client
   npm run dev
   ```
   Frontend will run on `http://localhost:5173`

## 📝 API Documentation

### Authentication Endpoints

- `POST /api/v1/admin/auth/login` - Admin login
- `POST /api/v1/admin/auth/register` - Admin registration
- `POST /api/v1/employee/auth/login` - Employee login
- `POST /api/v1/employee/auth/register` - Employee registration

### Employee Management

- `GET /api/v1/admin/employee` - Get all employees
- `POST /api/v1/employee/auth/register` - Create new employee
- `GET /api/v1/admin/employee/:employeeId` - Get employee details

### Attendance

- `POST /api/v1/both/attendance/check-in` - Check in
- `POST /api/v1/both/attendance/check-out` - Check out
- `GET /api/v1/both/attendance/stats` - Get attendance statistics

## 🔒 Security Features

- **CSRF Protection**: Double-submit cookie pattern
- **XSS Protection**: Input sanitization
- **SQL Injection Protection**: MongoDB sanitization
- **Rate Limiting**: API rate limiting
- **Password Hashing**: Bcrypt with salt rounds
- **JWT Authentication**: Secure token-based auth
- **CORS Configuration**: Environment-aware CORS settings

## ✨ Recent Improvements

- **Redis Caching**: High-performance caching layer with in-memory fallback
- **Background Job Queues**: Non-blocking email and notification processing
- **API Documentation**: Swagger/OpenAPI documentation
- **Enhanced Testing**: Expanded test coverage
- **Internationalization**: Multi-language support (i18n)
- **Improved Error Handling**: Standardized error responses

See `IMPROVEMENTS_SUMMARY.md` and `QUICK_START_IMPROVEMENTS.md` for details.

## 🧪 Testing

```bash
# Run server tests
cd server
npm test

# Run client tests
cd vite_client
npm test
```

## 📦 Building for Production

### Frontend
```bash
cd vite_client
npm run build
```

### Backend
The server runs directly with Node.js. For production:
```bash
cd server
NODE_ENV=production npm start
```

## 🚢 Deployment

### Frontend (Vercel)
1. Connect your repository to Vercel
2. Set build command: `cd vite_client && npm install && npm run build`
3. Set output directory: `vite_client/dist`

### Backend (Render/Railway)
1. Set environment variables
2. Set build command: `cd server && npm install`
3. Set start command: `cd server && npm start`

## 📚 Code Splitting & Performance

- **Lazy Loading**: All routes are lazy-loaded for optimal performance
- **Code Splitting**: Automatic chunk splitting by vendor libraries
- **Error Boundaries**: Route-level error boundaries for better error handling
- **Bundle Optimization**: Optimized chunk sizes and tree shaking

## 🔧 Development

### Code Style
- ESLint for code linting
- Consistent code formatting
- JSDoc comments for documentation

### TypeScript Support
TypeScript configuration is available. To migrate:
1. Install TypeScript: `npm install -D typescript @types/node @types/react`
2. Rename `.js` files to `.ts` or `.tsx`
3. Type definitions will be gradually added

## 📄 License

[Your License Here]

## 👥 Contributors

[Contributor names]

## 🐛 Known Issues

- None currently

## 🔮 Future Enhancements

- Full TypeScript migration
- Enhanced reporting features
- Mobile app development
- Advanced analytics dashboard
