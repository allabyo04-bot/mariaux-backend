const express = require('express');
const router = express.Router();
const { verifierToken, reserverAuCure } = require('../middleware/auth');
const { recettesDuJour, etatRecettes, exporterRecettesCsv } = require('../controllers/dashboardController');

router.use(verifierToken, reserverAuCure);

router.get('/recettes-jour', recettesDuJour);
router.get('/etat-recettes', etatRecettes);
router.get('/export-recettes-csv', exporterRecettesCsv);

module.exports = router;
