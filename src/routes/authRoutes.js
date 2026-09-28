const express = require('express');
const router = express.Router();
const { connexion, journalConnexions } = require('../controllers/authController');
const { verifierToken, reserverAuCure } = require('../middleware/auth');

router.post('/connexion', connexion);
router.get('/journal', verifierToken, reserverAuCure, journalConnexions);

module.exports = router;
