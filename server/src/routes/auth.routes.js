const express = require('express');
const {
  register,
  login,
  logout,
  getCurrentUser,
  refreshToken,
} = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getCurrentUser);
router.post('/refresh', refreshToken);

module.exports = router;
