# EMS-Paarsiv - Employee Management System

A comprehensive Employee Management System built with Node.js/Express backend and React/Vite frontend.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Security Features](#security-features)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## ✨ Features

### Admin Features
- Employee management (CRUD operations)
- Leave management and approval
- Payroll management
- Attendance tracking and rules
- Project management
- Role hierarchy management
- Calendar management
- ID card generation
- Salary structure management
- Notification management
- System settings

### Employee Features
- Profile management
- Leave application
- Attendance check-in/check-out
- Payroll viewing
- Project and task management
- Calendar viewing
- ID card viewing
- Notification viewing

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT (JSON Web Tokens)
- **Security:** Helmet, CORS, XSS protection, CSRF protection
- **File Upload:** Multer
- **Email:** Nodemailer

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **State Management:** Redux Toolkit with Redux Persist
- **Routing:** React Router v6
- **UI Libraries:** Material-UI, Tailwind CSS
- **Charts:** Chart.js, Recharts
- **HTTP Client:** Axios

## 📦 Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or cloud instance like MongoDB Atlas)
- npm or yarn
- Git

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd EMS-Paarsiv
```

### 2. Install Backend Dependencies

```bash
cd server
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../vite_client
npm install
```

### 4. Environment Configuration

#### Backend Environment Variables

Create a `.env` file in the `server` directory:

```bash
cp server/env.example server/.env
```

Edit `server/.env` with your configuration:

```env
# Database Configuration
MONGO_URI=mongodb://localhost:27017/paarsiv_hr

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend Configuration
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_min_32_characters_long
JWT_EXPIRE=7d

# Cookie/Domain Configuration
CROSS_SITE_COOKIES=false
DOMAIN=

# Email Configuration
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
EMAIL_FROM=your_email@example.com

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# Default Password for New Employees
DEFAULT_EMPLOYEE_PASSWORD=ChangeThisInProduction!123

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend Environment Variables (Optional)

Create a `.env` file in the `vite_client` directory:

```env
VITE_API_URL=http://localhost:5000/api
VITE_BACKEND_URL=http://localhost:5000
VITE_ALLOW_REGISTRATION=false
```

## 🏃 Running the Application

### Development Mode

#### Start Backend Server

```bash
cd server
npm run dev
```

The server will start on `http://localhost:5000`

#### Start Frontend Development Server

```bash
cd vite_client
npm run dev
```

The frontend will start on `http://localhost:5173`

### Production Mode

#### Build Frontend

```bash
cd vite_client
npm run build
```

#### Start Production Server

```bash
cd server
npm start
```

## 📚 API Documentation

### Base URL

- Development: `http://localhost:5000/api`
- Production: `https://your-domain.com/api`

### Authentication

All protected endpoints require JWT authentication via:
- Cookie: `jwt` (httpOnly)
- Header: `Authorization: Bearer <token>`
- CSRF Token: `x-csrf-token` header (required for state-changing requests)

### API Endpoints

#### Admin Routes
- `POST /api/v1/admin/auth/register` - Register admin (requires auth in production)
- `POST /api/v1/admin/auth/login` - Admin login
- `GET /api/v1/admin/auth/logout` - Admin logout
- `GET /api/v1/admin/employee` - Get all employees
- `POST /api/v1/admin/employee` - Create employee
- `PUT /api/v1/admin/employee/:id` - Update employee
- `DELETE /api/v1/admin/employee/:id` - Delete employee

#### Employee Routes
- `POST /api/v1/employee/auth/login` - Employee login
- `GET /api/v1/employee/auth/logout` - Employee logout
- `GET /api/v1/employee/leave` - Get employee leave requests
- `POST /api/v1/employee/leave` - Create leave request

#### Shared Routes
- `GET /api/v1/both/attendance` - Get attendance records
- `POST /api/v1/both/attendance/check-in` - Check in
- `POST /api/v1/both/attendance/check-out` - Check out
- `POST /api/v1/both/password/forgot-password` - Request password reset
- `POST /api/v1/both/password/reset-password/:token` - Reset password

For complete API documentation, see the API documentation files or use tools like Postman.

## 🔒 Security Features

### Implemented Security Measures

1. **Authentication & Authorization**
   - JWT-based authentication
   - Role-based access control (Admin/Employee)
   - Secure password hashing with bcrypt

2. **CSRF Protection**
   - Double-submit cookie pattern
   - Timing-safe token comparison
   - Token format validation

3. **Rate Limiting**
   - Login endpoints: 5 requests per 15 minutes
   - Password reset: 3 requests per hour
   - General API: 100 requests per 15 minutes (production)

4. **Input Validation**
   - Express-validator for request validation
   - MongoDB injection prevention
   - XSS protection

5. **File Upload Security**
   - File type validation
   - File size limits
   - MIME type verification
   - Filename sanitization
   - Directory traversal prevention

6. **CORS Configuration**
   - Strict origin validation in production
   - Configurable allowed origins
   - Credentials support

7. **Environment Security**
   - Environment variable validation
   - No hardcoded credentials
   - Secure defaults

## 🧪 Testing

### Run Backend Tests

```bash
cd server
npm test
```

### Run Frontend Tests

```bash
cd vite_client
npm test
```

### Test Coverage

```bash
cd server
npm run test:coverage
```

## 🚢 Deployment

### Backend Deployment (Render/Railway/etc.)

1. Set environment variables in your hosting platform
2. Ensure `NODE_ENV=production`
3. Set `MONGO_URI` to your production MongoDB instance
4. Configure `FRONTEND_URL` and `ALLOWED_ORIGINS`
5. Deploy

### Frontend Deployment (Vercel/Netlify)

1. Build the frontend: `npm run build`
2. Configure environment variables
3. Set `VITE_API_URL` to your backend URL
4. Deploy the `dist` folder

### Important Production Checklist

- [ ] Change `JWT_SECRET` from default
- [ ] Change `DEFAULT_EMPLOYEE_PASSWORD`
- [ ] Configure email credentials
- [ ] Set `FRONTEND_URL` and `ALLOWED_ORIGINS`
- [ ] Enable `CROSS_SITE_COOKIES=true` if frontend/backend are on different domains
- [ ] Review and adjust rate limiting
- [ ] Set up database backups
- [ ] Configure monitoring and logging
- [ ] Review CORS settings
- [ ] Test all authentication flows

## 🐛 Troubleshooting

### Common Issues

#### 1. MongoDB Connection Error

**Problem:** Cannot connect to MongoDB

**Solutions:**
- Verify MongoDB is running
- Check `MONGO_URI` in `.env`
- Ensure MongoDB is accessible from your network
- Check firewall settings

#### 2. CORS Errors

**Problem:** CORS policy errors in browser

**Solutions:**
- Verify `FRONTEND_URL` matches your frontend URL
- Add frontend URL to `ALLOWED_ORIGINS`
- Check CORS configuration in `server.js`
- Ensure credentials are enabled

#### 3. Authentication Issues

**Problem:** 401 Unauthorized errors

**Solutions:**
- Check JWT token is valid and not expired
- Verify CSRF token is included in headers
- Ensure cookies are enabled (if using cookie-based auth)
- Check token is stored in localStorage (if using header-based auth)

#### 4. Email Not Sending

**Problem:** Email functionality not working

**Solutions:**
- Verify email credentials in `.env`
- Check email service (SMTP) settings
- Ensure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` are set
- Test SMTP connection separately
- Check firewall/network restrictions

#### 5. File Upload Issues

**Problem:** Files not uploading

**Solutions:**
- Check file size limits
- Verify file type is allowed
- Ensure `uploads` directory exists and is writable
- Check file permissions

## 📝 Development Guidelines

### Code Style

- Use ESLint for code linting
- Follow existing code patterns
- Write meaningful commit messages
- Add comments for complex logic

### Security Guidelines

- Never commit `.env` files
- Use environment variables for all secrets
- Validate all user inputs
- Use parameterized queries
- Keep dependencies updated

### Testing Guidelines

- Write tests for new features
- Maintain test coverage > 80%
- Test both success and error cases
- Test authentication and authorization

## 📄 License

[Your License Here]

## 👥 Contributors

[Your Team/Contributors]

## 📞 Support

For support, email support@paarsiv.com or create an issue in the repository.

---

**Last Updated:** January 2025
