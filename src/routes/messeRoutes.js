const express = require('express');
const router = express.Router();
const { verifierToken, reserverAuCure } = require('../middleware/auth');
const { listerMesses, modifierDemandeMesse, corrigerIntention, listerCorrectionsIntention } = require('../controllers/messeController');

router.use(verifierToken);

router.get('/', listerMesses);
router.get('/corrections/journal', reserverAuCure, listerCorrectionsIntention);
router.put('/:id', modifierDemandeMesse);
router.put('/:id/intention', corrigerIntention);

module.exports = router;
