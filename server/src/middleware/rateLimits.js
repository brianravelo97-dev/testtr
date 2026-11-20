import rateLimit from 'express-rate-limit';

const message = (msg) => ({ error: msg });

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: message('Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.'),
});

export const openLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Demasiadas solicitudes de apertura. Espere un minuto.'),
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Demasiadas solicitudes. Intente más tarde.'),
});
