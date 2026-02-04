const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 80;

// Service URLs from environment variables
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4000',
  aiAssessment: process.env.AI_ASSESSMENT_SERVICE_URL || 'http://localhost:3001',
  customMcq: process.env.CUSTOM_MCQ_SERVICE_URL || 'http://localhost:3002',
  aiml: process.env.AIML_SERVICE_URL || 'http://localhost:3003',
  dsa: process.env.DSA_SERVICE_URL || 'http://localhost:3004',
  proctoring: process.env.PROCTORING_SERVICE_URL || 'http://localhost:3005',
  users: process.env.USER_SERVICE_URL || 'http://localhost:3006',
  superAdmin: process.env.SUPER_ADMIN_SERVICE_URL || 'http://localhost:3007',
  employee: process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:4005',
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
// Allow larger payloads for face verification (reference + live base64 images)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan('combined'));


app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Gateway', 
    version: '1.0.0',
    status: 'running',
    health: '/health'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-gateway' });
});

// JWT verification middleware
async function verifyToken(req, res, next) {
  // Skip auth for public routes
  const publicRoutes = [
    '/api/v1/auth/login',
    '/api/v1/auth/send-verification-code',
    '/api/v1/employees/verify-temp-password',
    '/api/v1/employees/set-password',
    '/api/v1/employees/login',
    '/api/v1/auth/verify-email-code',
    '/api/v1/auth/org-signup',
    '/api/v1/auth/org-signup-email',
    '/api/v1/auth/superadmin-signup',
    '/api/v1/auth/oauth-login',
    '/api/v1/auth/refresh-token',
    '/api/v1/auth/verify', 
    '/api/v1/super-admin/login', 
    '/api/v1/super-admin/verify-mfa', 
    '/api/v1/candidate', 
    '/api/v1/custom-mcq/candidate', 
    '/api/v1/dsa/candidate', 
    '/api/v1/aiml/candidate', 
    '/api/v1/dsa/assessment',
    '/api/v1/assessments/start-session', 
    '/api/v1/assessment', 
  ];

  let pathToCheck = (req.originalUrl || req.url || req.path || '').split('?')[0];
  // Normalize path - remove trailing slashes and ensure it starts with /
  pathToCheck = pathToCheck.replace(/\/$/, '') || '/';
  if (!pathToCheck.startsWith('/')) {
    pathToCheck = '/' + pathToCheck;
  }
  
  console.log('🔵 [API Gateway] verifyToken middleware:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    pathToCheck: pathToCheck,
    hasAuthHeader: !!req.headers.authorization,
    authHeader: req.headers.authorization ? 'Bearer ***' : 'none',
    publicRoutes: publicRoutes,
  });
  
  // Candidate-specific public endpoints for DSA/AIML tests (no auth required)
  // These are accessed by candidates via test links with just name/email verification
  const candidatePublicPatterns = [
    /^\/api\/v1\/dsa\/tests\/[^/]+\/verify-link$/,
    /^\/api\/v1\/dsa\/tests\/[^/]+\/verify-candidate$/,
    /^\/api\/v1\/dsa\/tests\/[^/]+\/start$/,
    /^\/api\/v1\/dsa\/tests\/[^/]+\/public$/,
    /^\/api\/v1\/dsa\/tests\/[^/]+\/submission$/,
    /^\/api\/v1\/dsa\/tests\/[^/]+\/question\/[^/]+$/,
    /^\/api\/v1\/dsa\/tests\/[^/]+\/final-submit$/,
    /^\/api\/v1\/dsa\/tests\/[^/]+\/full$/,
    /^\/api\/v1\/aiml\/tests\/[^/]+\/verify-link$/,
    /^\/api\/v1\/aiml\/tests\/[^/]+\/verify-candidate$/,
    /^\/api\/v1\/aiml\/tests\/[^/]+\/start$/,
    /^\/api\/v1\/aiml\/tests\/[^/]+\/public$/,
    /^\/api\/v1\/aiml\/tests\/[^/]+\/full$/,
    /^\/api\/v1\/aiml\/tests\/[^/]+\/candidate$/, // AIML candidate test data
    /^\/api\/v1\/aiml\/tests\/[^/]+\/submit-answer$/, // AIML submit individual answer
    /^\/api\/v1\/aiml\/tests\/[^/]+\/submit$/, // AIML final test submission
    /^\/api\/v1\/aiml\/tests\/get-reference-photo$/, // AIML reference photo retrieval
    /^\/api\/v1\/aiml\/tests\/save-reference-face$/, // AIML reference photo save
    /^\/api\/v1\/dsa\/tests\/get-reference-photo$/, // DSA reference photo retrieval
    /^\/api\/v1\/dsa\/tests\/save-reference-face$/, // DSA reference photo save
    // AIML dataset download endpoint for candidates
    /^\/api\/v1\/aiml\/questions\/[^/]+\/dataset-download$/,
    // Proctoring endpoints - candidates need to record violations without auth
    /^\/api\/v1\/proctor\/record$/,
    /^\/api\/v1\/proctor\/upload$/,
    /^\/api\/v1\/proctor\/start-session$/,
    /^\/api\/v1\/proctor\/live\/start-session$/, // Live proctoring session start
    /^\/api\/v1\/proctor\/verify-face$/, // Face verification (candidate, no auth)
  ];
  
  // Check if path matches candidate public patterns
  const isCandidatePublicRoute = candidatePublicPatterns.some(pattern => pattern.test(pathToCheck));
  if (isCandidatePublicRoute) {
    console.log(`✅ [API Gateway] Route matched as public (candidate pattern): ${pathToCheck}`);
  }
  
  const isPublicRoute = isCandidatePublicRoute || publicRoutes.some(route => {
    // Normalize route for comparison
    const normalizedRoute = route.replace(/\/$/, '') || '/';
    
    // Exact match
    if (pathToCheck === normalizedRoute) {
      console.log(`✅ [API Gateway] Route matched as public (exact): ${pathToCheck} === ${normalizedRoute}`);
      return true;
    }
    // Path starts with route followed by / (to avoid partial matches)
    if (pathToCheck.startsWith(normalizedRoute + '/')) {
      console.log(`✅ [API Gateway] Route matched as public (prefix): ${pathToCheck} starts with ${normalizedRoute}/`);
      return true;
    }
    return false;
  });
  
  console.log(`🔵 [API Gateway] Is public route: ${isPublicRoute} for path: ${pathToCheck}`);
  
  if (isPublicRoute) {
    console.log('✅ [API Gateway] Skipping auth check for public route');
    return next();
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('🔴 [API Gateway] Auth required but missing/invalid header:', {
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
      path: pathToCheck,
    });
    console.error('🔴 [API Gateway] Returning 401 - Missing or invalid authorization header');
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required',
      detail: 'Missing or invalid authorization header'
    });
  }

  const token = authHeader.substring(7);

  try {
    // Verify token with auth service
    const verifyResponse = await axios.post(
      `${SERVICES.auth}/api/v1/auth/verify`,
      { token },
      {
        headers: {
          'X-Correlation-ID': req.correlationId,
        },
        timeout: 5000,
      }
    );

    if (verifyResponse.data.success && verifyResponse.data.data) {
      const userData = verifyResponse.data.data;
      
      // Inject user context into headers
      req.headers['x-user-id'] = userData.userId;
      req.headers['x-org-id'] = userData.orgId || '';
      req.headers['x-role'] = userData.role;
      
      console.log('✅ [API Gateway] Token verified successfully:', {
        userId: userData.userId,
        orgId: userData.orgId,
        role: userData.role,
        path: pathToCheck,
      });
      
      next();
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error('🔴 [API Gateway] Auth service connection error:', {
        code: error.code,
        message: error.message,
        authServiceUrl: SERVICES.auth,
        path: pathToCheck,
      });
      return res.status(503).json({
        success: false,
        message: 'Authentication service unavailable',
        detail: 'Unable to connect to authentication service',
      });
    }
    
    if (error.response?.status === 401) {
      console.error('🔴 [API Gateway] Token verification failed - Invalid or expired token:', {
        path: pathToCheck,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
    
    console.error('🔴 [API Gateway] Token verification error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      path: pathToCheck,
    });
    
    return res.status(503).json({
      success: false,
      message: 'Authentication service unavailable',
      detail: error.message,
    });
  }
}

// Apply auth middleware to all routes except public ones and employee routes
// Employee routes are handled by verifyEmployeeToken middleware
app.use('/api', (req, res, next) => {
  // Skip employee routes - they use verifyEmployeeToken instead
  const pathToCheck = (req.originalUrl || req.url || req.path || '').split('?')[0];
  
  if (pathToCheck.startsWith('/api/v1/employee/')) {
    console.log('✅ [API Gateway] Skipping verifyToken for employee route:', pathToCheck);
    return next();
  }
  
  // For all other routes, use regular token verification
  return verifyToken(req, res, next);
});

// Proxy configuration
const proxyOptions = {
  target: '', // Will be set per route
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api', // Keep /api prefix
  },
  timeout: 120000, // 120 seconds (2 minutes) - increased for AI operations
  onProxyReq: (proxyReq, req, res) => {
    const targetUrl = proxyReq.path;
    const targetHost = proxyReq.getHeader('host');
    const isAIMLRequest = req.originalUrl?.includes('/api/v1/aiml');
    
    console.log('🟢 [API Gateway] Proxy request:', {
      method: req.method,
      originalUrl: req.originalUrl,
      target: targetUrl,
      targetHost: targetHost,
      targetFullURL: `http://${targetHost}${targetUrl}`,
      headers: Object.keys(req.headers),
      hasBody: !!req.body,
      contentType: req.headers['content-type'],
      isAIMLRequest: isAIMLRequest,
      timestamp: new Date().toISOString(),
    });
    
    // Additional logging for AIML requests
    if (isAIMLRequest) {
      console.log('🧠 [API Gateway] AIML Proxy Request Details:', {
        originalPath: req.path,
        originalUrl: req.originalUrl,
        targetService: SERVICES.aiml,
        targetPath: targetUrl,
        targetHost: targetHost,
        method: req.method,
        body: req.body ? JSON.stringify(req.body).substring(0, 200) : 'none',
        correlationId: req.correlationId,
      });
    }
    
    // Forward correlation ID
    proxyReq.setHeader('X-Correlation-ID', req.correlationId);
    
    // Forward user context headers
    if (req.headers['x-user-id']) {
      proxyReq.setHeader('X-User-Id', req.headers['x-user-id']);
    }
    if (req.headers['x-org-id']) {
      proxyReq.setHeader('X-Org-Id', req.headers['x-org-id']);
    }
    if (req.headers['x-role']) {
      proxyReq.setHeader('X-Role', req.headers['x-role']);
    }
    
    // If body was parsed by express.json(), we need to write it to the proxy request
    // http-proxy-middleware doesn't automatically forward req.body when it's already parsed
    if (req.body && !req.readable) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.write(bodyData);
      console.log('🔵 [API Gateway] Writing parsed body to proxy:', {
        bodyLength: bodyData.length,
        bodyPreview: bodyData.substring(0, 100),
        isAIMLRequest: isAIMLRequest,
      });
    }
  },
  onError: (err, req, res) => {
    // Identify which service failed based on the request path
    const path = req.originalUrl || req.url || '';
    let serviceName = 'Unknown Service';
    let targetHost = req.headers.host || 'unknown';
    let targetServiceUrl = '';
    
    // Try to extract target from the proxy request if available
    if (req.socket && req.socket.remoteAddress) {
      targetHost = req.socket.remoteAddress;
    }
    
    // Map paths to service names and URLs
    if (path.includes('/api/v1/assessments') || path.includes('/api/v1/assessment')) {
      serviceName = 'AI Assessment Service';
      targetHost = 'localhost:3001';
      targetServiceUrl = SERVICES.aiAssessment;
    } else if (path.includes('/api/v1/custom-mcq')) {
      serviceName = 'Custom MCQ Service';
      targetHost = 'localhost:3002';
      targetServiceUrl = SERVICES.customMcq;
    } else if (path.includes('/api/v1/aiml')) {
      serviceName = 'AIML Service';
      targetHost = 'localhost:3003';
      targetServiceUrl = SERVICES.aiml;
    } else if (path.includes('/api/v1/dsa')) {
      serviceName = 'DSA Service';
      targetHost = 'localhost:3004';
      targetServiceUrl = SERVICES.dsa;
    } else if (path.includes('/api/v1/devops')) {
      serviceName = 'DevOps Service (AI Assessment)';
      targetHost = 'localhost:3001';
      targetServiceUrl = SERVICES.aiAssessment;  // DevOps tests are handled by AI Assessment service
    } else if (path.includes('/api/v1/cloud')) {
      serviceName = 'Cloud Service (AI Assessment)';
      targetHost = 'localhost:3001';
      targetServiceUrl = SERVICES.aiAssessment;  // Cloud tests are handled by AI Assessment service
    } else if (path.includes('/api/v1/data-engineering')) {
      serviceName = 'Data Engineering Service (AI Assessment)';
      targetHost = 'localhost:3001';
      targetServiceUrl = SERVICES.aiAssessment;  // Data Engineering tests are handled by AI Assessment service
    } else if (path.includes('/api/v1/design')) {
      serviceName = 'Design Service (AI Assessment)';
      targetHost = 'localhost:3001';
      targetServiceUrl = SERVICES.aiAssessment;  // Design tests are handled by AI Assessment service
    } else if (path.includes('/api/v1/proctor')) {
      serviceName = 'Proctoring Service';
      targetHost = 'localhost:3005';
      targetServiceUrl = SERVICES.proctoring;
    } else if (path.includes('/api/v1/users')) {
      serviceName = 'Users Service (Auth Service)';
      targetHost = 'localhost:4000';  // Users endpoints are in auth service
      targetServiceUrl = SERVICES.auth;
    } else if (path.includes('/api/v1/super-admin')) {
      serviceName = 'Super Admin Service';
      targetHost = 'localhost:3007';
      targetServiceUrl = SERVICES.superAdmin;
    } else if (path.includes('/api/v1/employees')) {
      serviceName = 'Employee Service';
      targetHost = 'localhost:4005';
      targetServiceUrl = SERVICES.employee;
    } else if (path.includes('/api/v1/auth')) {
      serviceName = 'Auth Service';
      targetHost = 'localhost:4000';
      targetServiceUrl = SERVICES.auth;
    }
    
    // Provide better error message when err.message is empty
    let errorMessage = err.message || err.code || 'Unknown error';
    if (err.code === 'ECONNREFUSED') {
      errorMessage = `Connection refused - ${serviceName} is not running on ${targetHost}`;
    } else if (err.code === 'ETIMEDOUT') {
      errorMessage = `Connection timeout - ${serviceName} did not respond in time`;
    }
    
    // Enhanced error logging
    console.error('🔴 [API Gateway] Proxy error - DETAILED:', {
      timestamp: new Date().toISOString(),
      service: serviceName,
      targetHost: targetHost,
      targetServiceUrl: targetServiceUrl,
      errorCode: err.code,
      errorMessage: err.message,
      errorStack: err.stack,
      errorName: err.name,
      errorSyscall: err.syscall,
      errorAddress: err.address,
      errorPort: err.port,
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      requestPath: req.path,
      requestHeaders: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'authorization': req.headers['authorization'] ? 'Bearer ***' : 'none',
        'x-correlation-id': req.correlationId,
      },
      requestBody: req.body ? JSON.stringify(req.body).substring(0, 200) : 'none',
      clientIP: req.ip || req.connection?.remoteAddress,
    });
    
    // Log connection attempt details for ECONNREFUSED
    if (err.code === 'ECONNREFUSED') {
      console.error('🔴 [API Gateway] Connection Refused Details:', {
        attemptedURL: targetServiceUrl,
        attemptedHost: targetHost,
        serviceName: serviceName,
        suggestion: `Please ensure ${serviceName} is running on ${targetHost}. Check if the service is started.`,
      });
    }
    
    res.status(503).json({
      success: false,
      message: 'Service unavailable',
      detail: errorMessage,
      service: serviceName,
      target: targetHost,
      errorCode: err.code,
      timestamp: new Date().toISOString(),
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('🟢 [API Gateway] Proxy response:', {
      statusCode: proxyRes.statusCode,
      statusMessage: proxyRes.statusMessage,
      url: req.originalUrl,
      headers: Object.keys(proxyRes.headers),
      contentType: proxyRes.headers['content-type'],
      contentLength: proxyRes.headers['content-length'],
    });
    
    // Capture response body for logging (only for generate-topic-cards endpoint)
    if (req.originalUrl && req.originalUrl.includes('generate-topic-cards')) {
      let responseBody = '';
      const chunks = [];
      
      // Store original methods
      const originalWrite = res.write.bind(res);
      const originalEnd = res.end.bind(res);
      
      // Override write to capture chunks
      res.write = function(chunk) {
        if (chunk) {
          chunks.push(chunk);
        }
        return originalWrite(chunk);
      };
      
      // Override end to log body
      res.end = function(chunk) {
        if (chunk) {
          chunks.push(chunk);
        }
        
        // Combine all chunks
        const buffer = Buffer.concat(chunks);
        try {
          responseBody = buffer.toString('utf8');
          const parsed = JSON.parse(responseBody);
          console.log('🔵 [API Gateway] generate-topic-cards Response Body:', {
            bodyLength: responseBody.length,
            parsed: parsed,
            hasSuccess: 'success' in (parsed || {}),
            successValue: parsed?.success,
            hasData: 'data' in (parsed || {}),
            dataKeys: parsed?.data ? Object.keys(parsed.data) : null,
            hasCards: parsed?.data ? 'cards' in parsed.data : false,
            cardsCount: Array.isArray(parsed?.data?.cards) ? parsed.data.cards.length : null,
          });
        } catch (e) {
          console.log('🔵 [API Gateway] generate-topic-cards Response Body (raw):', {
            bodyLength: responseBody.length,
            preview: responseBody.substring(0, 500),
            parseError: e.message,
          });
        }
        
        return originalEnd(chunk);
      };
    }
    
    // Add correlation ID to response
    proxyRes.headers['X-Correlation-ID'] = req.correlationId;
    
    // Rewrite Location header in redirects to go through the gateway
    // This prevents CORS issues when services redirect (e.g., trailing slash redirects)
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      const location = proxyRes.headers.location;
      // If redirect points to a backend service URL, rewrite it to go through gateway
      const backendUrlPattern = /http:\/\/localhost:(300[1-9]|400[0-9]|500[0-9])(\/.*)/;
      const match = location.match(backendUrlPattern);
      if (match) {
        // Extract the path from the redirect location
        const newLocation = match[2]; // The path part
        proxyRes.headers.location = newLocation;
        console.log('🔵 [API Gateway] Rewrote redirect location:', {
          original: location,
          rewritten: newLocation,
        });
      }
    }
  },
};

// Route: Auth Service
console.log('🔵 [API Gateway] Setting up auth service proxy:', {
  route: '/api/v1/auth',
  target: SERVICES.auth,
});

app.use(
  '/api/v1/auth',
  (req, res, next) => {
    console.log('🟡 [API Gateway] Auth service route matched:', {
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      path: req.path,
    });
    next();
  },
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.auth,
    logLevel: 'debug',
    logProvider: () => ({
      log: (msg) => console.log('🟡 [HPM]', msg),
      debug: (msg) => console.log('🔵 [HPM]', msg),
      info: (msg) => console.log('🟢 [HPM]', msg),
      warn: (msg) => console.warn('🟠 [HPM]', msg),
      error: (msg) => console.error('🔴 [HPM]', msg),
    }),
  })
);

// Route: AI Assessment Service
app.use(
  '/api/v1/assessments',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.aiAssessment,
  })
);

// Route: Assessment code execution (singular - for /api/v1/assessment/run, etc.)
app.use(
  '/api/v1/assessment',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.aiAssessment,
  })
);

// Route: Custom MCQ Service
app.use(
  '/api/v1/custom-mcq',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.customMcq,
  })
);

// Route: AIML Service
console.log('🔵 [API Gateway] Setting up AIML service proxy:', {
  route: '/api/v1/aiml',
  target: SERVICES.aiml,
});

app.use(
  '/api/v1/aiml',
  (req, res, next) => {
    console.log('🟡 [API Gateway] AIML service route matched:', {
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      path: req.path,
      target: SERVICES.aiml,
      timestamp: new Date().toISOString(),
    });
    next();
  },
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.aiml,
    logLevel: 'debug',
    logProvider: () => ({
      log: (msg) => console.log('🟡 [HPM-AIML]', msg),
      debug: (msg) => console.log('🔵 [HPM-AIML]', msg),
      info: (msg) => console.log('🟢 [HPM-AIML]', msg),
      warn: (msg) => console.warn('🟠 [HPM-AIML]', msg),
      error: (msg) => console.error('🔴 [HPM-AIML]', msg),
    }),
  })
);

// Route: DSA Service
app.use(
  '/api/v1/dsa',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.dsa,
  })
);

// Route: DevOps Service (proxied to AI Assessment Service - DevOps tests are assessments)
app.use(
  '/api/v1/devops',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.aiAssessment,  // DevOps tests are handled by AI Assessment service
  })
);

// Route: Cloud Service (proxied to AI Assessment Service - Cloud tests are assessments)
app.use(
  '/api/v1/cloud',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.aiAssessment,  // Cloud tests are handled by AI Assessment service
  })
);

// Route: Data Engineering Service (proxied to AI Assessment Service - Data Engineering tests are assessments)
app.use(
  '/api/v1/data-engineering',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.aiAssessment,  // Data Engineering tests are handled by AI Assessment service
  })
);

// Route: Design Service (proxied to AI Assessment Service - Design tests are assessments)
app.use(
  '/api/v1/design',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.aiAssessment,  // Design tests are handled by AI Assessment service
  })
);

// Route: Proctoring Service
app.use(
  '/api/v1/proctor',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.proctoring,
  })
);

app.use(
  '/api/v1/proctoring',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.proctoring,
  })
);

// Route: User Service - proxied to Auth Service (users are managed in auth service)
app.use(
  '/api/v1/users',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.auth,  // Users endpoints are in auth service
  })
);

// Route: Candidate get-reference-photo endpoint (route to AIML service, which handles both AIML and non-AIML tests)
// The AIML service will return "No reference photo found" for non-AIML tests, which is acceptable
app.use(
  '/api/v1/candidate/get-reference-photo',
  (req, res, next) => {
    console.log('🟡 [API Gateway] get-reference-photo route matched, routing to AIML service:', {
      method: req.method,
      url: req.url,
      query: req.query,
      target: SERVICES.aiml,
    });
    next();
  },
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.aiml,
    pathRewrite: {
      '^/api/v1/candidate/get-reference-photo': '/api/v1/aiml/tests/get-reference-photo',
    },
    onError: (err, req, res) => {
      console.error('🔴 [API Gateway] AIML service error for get-reference-photo:', {
        error: err.message,
        code: err.code,
        url: req.url,
      });
      // Return error response
      res.status(503).json({
        success: false,
        message: 'Service unavailable',
        detail: err.message,
        service: 'AIML Service',
      });
    },
  })
);

// Route: Candidate save-reference-face endpoint (route to AIML service for AIML tests)
app.use(
  '/api/v1/candidate/save-reference-face',
  (req, res, next) => {
    console.log('🟡 [API Gateway] save-reference-face route matched, routing to AIML service:', {
      method: req.method,
      url: req.url,
      body: req.body ? { ...req.body, referenceImage: req.body.referenceImage ? '[image data]' : 'none' } : 'none',
      target: SERVICES.aiml,
    });
    next();
  },
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.aiml,
    pathRewrite: {
      '^/api/v1/candidate/save-reference-face': '/api/v1/aiml/tests/save-reference-face',
    },
    onError: (err, req, res) => {
      console.error('🔴 [API Gateway] AIML service error for save-reference-face:', {
        error: err.message,
        code: err.code,
        url: req.url,
      });
      // Return error response
      res.status(503).json({
        success: false,
        message: 'Service unavailable',
        detail: err.message,
        service: 'AIML Service',
      });
    },
  })
);

// Route: Candidate endpoints (proxy to appropriate service)
app.use(
  '/api/v1/candidate',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.aiAssessment, // Candidate endpoints are in assessment service
  })
);

// Route: Super Admin endpoints
app.use(
  '/api/v1/super-admin',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.superAdmin, // Super Admin Service
  })
);

// Route: Employee Service
app.use(
  '/api/v1/employees',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.employee,
  })
);

// ============================================================================
// EMPLOYEE TOKEN VERIFICATION MIDDLEWARE
// ============================================================================

/**
 * Verify employee JWT token
 * Employee tokens are issued by employee-service and contain:
 * - employeeId
 * - aaptorId
 * - organizationId
 * - type: "employee"
 */
async function verifyEmployeeToken(req, res, next) {
  console.log('🔵 [API Gateway] verifyEmployeeToken called for:', req.path);
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      detail: 'Employee token required. Please provide Authorization: Bearer <token>'
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Verify JWT token using employee service secret
    // The secret should match JWT_SECRET from employee-service
    const employeeJwtSecret = process.env.EMPLOYEE_JWT_SECRET || process.env.JWT_SECRET || 'change-me';
    
    // First, decode without verification to see the payload structure
    const unverified = jwt.decode(token, { complete: false });
    console.log('🔵 [API Gateway] Unverified token payload:', JSON.stringify(unverified, null, 2));
    
    // Now verify with secret
    let decoded;
    try {
      decoded = jwt.verify(token, employeeJwtSecret);
      console.log('✅ [API Gateway] Token verified successfully with secret');
    } catch (verifyError) {
      console.error('🔴 [API Gateway] Token verification failed:', {
        error: verifyError.message,
        errorName: verifyError.name,
        secretSet: !!employeeJwtSecret,
        secretLength: employeeJwtSecret?.length || 0,
        unverifiedPayload: unverified
      });
      
      // Check if it's a secret mismatch
      if (verifyError.message.includes('invalid signature') || verifyError.message.includes('jwt malformed')) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          detail: 'Token verification failed. JWT secret mismatch. Please ensure EMPLOYEE_JWT_SECRET or JWT_SECRET matches the employee-service JWT_SECRET. Check API Gateway console for details.'
        });
      }
      
      throw verifyError;
    }
    
    console.log('🔵 [API Gateway] Decoded token payload (full):', JSON.stringify(decoded, null, 2));
    console.log('🔵 [API Gateway] Decoded token payload (summary):', {
      type: decoded.type,
      employeeId: decoded.employeeId,
      organizationId: decoded.organizationId,
      aaptorId: decoded.aaptorId,
      hasType: 'type' in decoded,
      allKeys: Object.keys(decoded),
      tokenLength: token.length
    });
    
    // Validate token type
    // Note: Some JWT libraries might use different field names or structures
    // Check for type field in various possible locations
    const tokenType = decoded.type || decoded.typ || decoded.token_type;
    
    if (!tokenType || tokenType !== 'employee') {
      console.error('🔴 [API Gateway] Invalid token type. Full decoded payload:', JSON.stringify(decoded, null, 2));
      console.error('🔴 [API Gateway] Token type check failed:', {
        expected: 'employee',
        received: tokenType,
        decodedType: decoded.type,
        decodedTyp: decoded.typ,
        decodedTokenType: decoded.token_type,
        typeExists: 'type' in decoded,
        allKeys: Object.keys(decoded),
        decodedValue: JSON.stringify(decoded)
      });
      
      // If token has employeeId and organizationId but no type, it's likely an employee token
      // This is a temporary workaround for tokens generated before type field was added
      if (decoded.employeeId && decoded.organizationId && !tokenType) {
        console.warn('⚠️ [API Gateway] Token missing type field but has employeeId and organizationId. Assuming employee token.');
        // Continue with employee token validation
      } else {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          detail: `Invalid token type. Employee token required. Received type: ${tokenType || 'undefined'}. Token keys: ${Object.keys(decoded).join(', ')}. Full payload: ${JSON.stringify(decoded)}`
        });
      }
    }
    
    // Extract and validate employee info
    if (!decoded.employeeId || !decoded.organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        detail: 'Token missing required fields (employeeId, organizationId)'
      });
    }
    
    // Attach employee info to request
    req.employee = {
      employeeId: decoded.employeeId,
      aaptorId: decoded.aaptorId,
      organizationId: decoded.organizationId,
      email: decoded.email || null // Should be in token now
    };
    
    console.log('✅ [API Gateway] Employee token verified and attached to request:', {
      employeeId: req.employee.employeeId,
      aaptorId: req.employee.aaptorId,
      organizationId: req.employee.organizationId,
      hasEmail: !!req.employee.email
    });
    
    console.log('✅ [API Gateway] Employee token verified:', {
      employeeId: req.employee.employeeId,
      aaptorId: req.employee.aaptorId,
      organizationId: req.employee.organizationId,
      path: req.path
    });
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        detail: 'Token has expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        detail: 'Invalid token'
      });
    }
    
    console.error('🔴 [API Gateway] Employee token verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      detail: 'Token verification failed'
    });
  }
}

// ============================================================================
// SERVICE-TO-SERVICE AUTHENTICATION
// ============================================================================

/**
 * Generate service-to-service authentication token
 * This token is used when API Gateway calls other services
 */
function generateServiceToken() {
  const serviceSecret = process.env.SERVICE_TO_SERVICE_SECRET || process.env.JWT_SECRET || 'change-me';
  
  const payload = {
    service: 'api-gateway',
    type: 'service',
    timestamp: Date.now()
  };
  
  return jwt.sign(payload, serviceSecret, { expiresIn: '5m' });
}

// ============================================================================
// EMPLOYEE ALL TESTS AGGREGATION ENDPOINT
// ============================================================================

// Rate limiting for employee tests endpoint
const employeeTestLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per employee
  keyGenerator: (req) => {
    return req.employee?.employeeId || req.ip;
  },
  message: {
    success: false,
    error: 'Too Many Requests',
    detail: 'Rate limit exceeded. Maximum 10 requests per minute.'
  }
});

app.get('/api/v1/employee/all-tests', 
  verifyEmployeeToken,
  employeeTestLimiter,
  async (req, res) => {
    const { employee } = req;
    const { email, aaptorId, organizationId, employeeId } = employee;
    
    // Validate required fields
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        detail: 'Employee organizationId is required'
      });
    }
    
    // Email should be in token now, but fallback to fetching if needed
    let employeeEmail = email;
    if (!employeeEmail) {
      console.warn('⚠️ [API Gateway] Email not in token, attempting to fetch from employee service');
      try {
        // Try to fetch by aaptorId (which we have in token)
        const serviceToken = generateServiceToken();
        // Note: Employee service doesn't have GET by ID, but we can use aaptorId if needed
        // For now, email should be in token, so this is a fallback
        console.error('🔴 [API Gateway] Email not in token and cannot fetch - email is required in token');
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          detail: 'Employee email is required in token. Please ensure employee login includes email in token.'
        });
      } catch (error) {
        console.error('🔴 [API Gateway] Failed to fetch employee email:', error.message);
        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          detail: 'Unable to fetch employee information'
        });
      }
    }
    
    if (!employeeEmail) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        detail: 'Employee email is required'
      });
    }
    
    console.log('🔵 [API Gateway] Using employee email from token:', employeeEmail);
    
    // Prepare query parameters for all services
    const queryParams = {
      email: employeeEmail.toLowerCase().trim(),
      organizationId: organizationId,
      aaptorId: aaptorId || null
    };
    
    // Generate service-to-service token
    const serviceToken = generateServiceToken();
    
    // Define all service endpoints to query
    const serviceEndpoints = [
      {
        name: 'ai-assessment',
        url: `${SERVICES.aiAssessment}/api/v1/candidate/employee-tests`,
        type: 'assessment'
      },
      {
        name: 'dsa',
        url: `${SERVICES.dsa}/api/v1/dsa/employee-tests`,
        type: 'dsa'
      },
      {
        name: 'aiml',
        url: `${SERVICES.aiml}/api/v1/aiml/employee-tests`,
        type: 'aiml'
      },
      {
        name: 'custom-mcq',
        url: `${SERVICES.customMcq}/api/v1/custom-mcq/employee-tests`,
        type: 'custom_mcq'
      }
    ];
    
    // Make parallel requests to all services
    const servicePromises = serviceEndpoints.map(async (service) => {
      try {
        const response = await axios.get(service.url, {
          params: queryParams,
          timeout: 5000, // 5 second timeout per service
          headers: {
            'Authorization': `Bearer ${serviceToken}`,
            'X-Service-Request': 'true',
            'X-Organization-Id': organizationId,
            'X-Employee-Id': employeeId,
            'X-Correlation-ID': req.correlationId
          }
        });
        
        return {
          service: service.name,
          type: service.type,
          success: true,
          tests: response.data?.data?.tests || response.data?.tests || [],
          error: null
        };
      } catch (error) {
        console.error(`🔴 [API Gateway] Error fetching tests from ${service.name}:`, {
          message: error.message,
          status: error.response?.status,
          detail: error.response?.data?.detail
        });
        
        return {
          service: service.name,
          type: service.type,
          success: false,
          tests: [],
          error: error.response?.data?.detail || error.message || 'Service unavailable'
        };
      }
    });
    
    // Wait for all requests (with Promise.allSettled to handle partial failures)
    const results = await Promise.allSettled(servicePromises);
    
    // Process results
    const allTests = [];
    const serviceStatus = [];
    
    results.forEach((result, index) => {
      const service = serviceEndpoints[index];
      
      if (result.status === 'fulfilled') {
        const serviceResult = result.value;
        serviceStatus.push({
          service: service.name,
          success: serviceResult.success,
          testCount: serviceResult.tests.length,
          error: serviceResult.error
        });
        
        // Add tests with service metadata
        serviceResult.tests.forEach(test => {
          allTests.push({
            ...test,
            service: service.name,
            testType: serviceResult.type
          });
        });
      } else {
        serviceStatus.push({
          service: service.name,
          success: false,
          testCount: 0,
          error: result.reason?.message || 'Unknown error'
        });
      }
    });
    
    // Sort tests by inviteSentAt (most recent first)
    allTests.sort((a, b) => {
      const dateA = new Date(a.inviteSentAt || a.invited_at || 0);
      const dateB = new Date(b.inviteSentAt || b.invited_at || 0);
      return dateB - dateA;
    });
    
    // Calculate statistics
    const byType = {
      assessment: allTests.filter(t => t.testType === 'assessment').length,
      dsa: allTests.filter(t => t.testType === 'dsa').length,
      aiml: allTests.filter(t => t.testType === 'aiml').length,
      custom_mcq: allTests.filter(t => t.testType === 'custom_mcq').length
    };
    
    // Return aggregated response
    res.json({
      success: true,
      data: {
        tests: allTests,
        meta: {
          total: allTests.length,
          byType: byType,
          servicesQueried: serviceEndpoints.map(s => s.name),
          serviceStatus: serviceStatus,
          employee: {
            email: employeeEmail,
            aaptorId: aaptorId,
            organizationId: organizationId
          }
        }
      }
    });
  }
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Gateway error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    correlationId: req.correlationId,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log('📡 Service endpoints:');
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`   ${name}: ${url}`);
  });
});

