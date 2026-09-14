const express = require('express');
const router = express.Router();
const { connexion } = require('../controllers/authController');

router.post('/connexion', connexion);

module.exports = router;
