const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const rawClientUrls = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.split(',').map(u => u.trim()).filter(Boolean)
  : [];
const isProduction = process.env.NODE_ENV === 'production';

const corsOriginHandler = (origin, callback) => {
  // Allow requests with no origin (mobile apps, server-to-server, curl)
  if (!origin) return callback(null, true);
  if (!isProduction || rawClientUrls.length === 0 || rawClientUrls.includes('*') || rawClientUrls.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`Origin ${origin} not allowed by CORS`));
};

const corsOptions = {
  origin: corsOriginHandler,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'X-Requested-With']
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

const prisma = require('./prismaClient');

const jwt = require('jsonwebtoken');

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors(corsOptions));
// Serve local static file uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Preserve raw request body buffer for cryptographic payment webhook signature verification (50MB limit for branding/logo data)
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Socket.io Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || 
    (socket.handshake.headers?.authorization && socket.handshake.headers.authorization.split(' ')[1]) || 
    socket.handshake.query?.token;

  if (!token) {
    // If no token, allow connection with guest/unauthenticated state, but block joining private tenant rooms
    socket.user = null;
    return next();
  }

  const secret = process.env.JWT_SECRET || 'secret-key-for-dev';
  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      socket.user = null;
      return next();
    }
    socket.user = decoded;
    next();
  });
});

// Socket.io for Real-Time (Leaves, Fees, Attendance)
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} (user: ${socket.user?.id || 'anonymous'})`);
  
  socket.on('join_tenant', (payload) => {
    const schoolId = typeof payload === 'object' && payload !== null ? payload.schoolId : payload;
    const providedToken = typeof payload === 'object' && payload !== null ? payload.token : null;

    let user = socket.user;
    if (!user && providedToken) {
      const secret = process.env.JWT_SECRET || 'secret-key-for-dev';
      try {
        user = jwt.verify(providedToken, secret);
        socket.user = user;
      } catch (e) {
        console.warn(`Invalid token provided in join_tenant:`, e.message);
      }
    }

    if (!user) {
      console.warn(`Socket ${socket.id} attempted to join tenant ${schoolId} without authentication`);
      return socket.emit('error', { message: 'Authentication required to join tenant room', code: 'UNAUTHORIZED' });
    }

    const userRole = (user.role || '').toUpperCase();
    const userSchoolId = user.schoolId;

    if (userRole === 'SUPER_ADMIN' || (userSchoolId && userSchoolId === schoolId)) {
      socket.join(schoolId);
      console.log(`Socket ${socket.id} joined tenant room ${schoolId}`);
    } else {
      console.warn(`Unauthorized join_tenant attempt: Socket ${socket.id} (user school: ${userSchoolId}) -> target: ${schoolId}`);
      socket.emit('error', { message: 'Tenant access denied', code: 'TENANT_ACCESS_DENIED' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Pass io and prisma to routes
app.use((req, res, next) => {
  req.io = io;
  req.prisma = prisma;
  next();
});

// Import routes
const authRoutes = require('./routes/auth');
const schoolRoutes = require('./routes/schools');
const academicRoutes = require('./routes/academic');
const roleRoutes = require('./routes/roles');
const staffRoutes = require('./routes/staff');
const staffInviteRoutes = require('./routes/staffInvite');
const studentRoutes = require('./routes/students');
const documentRoutes = require('./routes/documents');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leaves');
const feeRoutes = require('./routes/fees');
const aiRoutes = require('./routes/ai');
const uploadRoutes = require('./routes/upload');
const emailRoutes = require('./routes/email');
const whatsappRoutes = require('./routes/whatsapp');
const ticketRoutes = require('./routes/tickets');
const examRoutes = require('./routes/exams');
const assessmentRoutes = require('./routes/assessments');
const reportCardRoutes = require('./routes/reportCards');
const reportCardTemplateRoutes = require('./routes/reportCardTemplates');

// Health & Readiness Checks
const livenessHandler = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Quaders API is running',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
};

const readinessHandler = async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', name: 'Quaders Backend API', time: new Date().toISOString() });
});
app.get('/health', livenessHandler);
app.get('/api/health', livenessHandler);
app.get('/health/ready', readinessHandler);
app.get('/api/health/ready', readinessHandler);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/superadmin/schools', schoolRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/staff-invite', staffInviteRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/schools/:schoolId/collections', documentRoutes);
app.use('/api/schools/:schoolId/attendance', attendanceRoutes);
app.use('/api/schools/:schoolId/leaves', leaveRoutes);
app.use('/api/schools/:schoolId/fees', feeRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/schools/:schoolId/upload', uploadRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/whatsapp-service', whatsappRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/tickets', ticketRoutes);

// Exams, Results & Report Cards Module (v1 & unversioned aliases)
app.use('/api/v1/exams', examRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/v1/assessments', assessmentRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/v1/report-cards', reportCardRoutes);
app.use('/api/report-cards', reportCardRoutes);
app.use('/api/v1/report-card-templates', reportCardTemplateRoutes);
app.use('/api/report-card-templates', reportCardTemplateRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'SERVER_ERROR'
  });
});

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Quaders server running on port ${PORT}`);
});
