const express = require('express');
const router = express.Router();
const { verifierToken, reserverAuCure } = require('../middleware/auth');
const { recettesDuJour, recettesSemaine, etatRecettes, exporterRecettesCsv } = require('../controllers/dashboardController');

router.use(verifierToken);

// Accessibles aux deux rôles : la Caisse doit pouvoir voir son propre récap
// du jour et de la semaine, indépendamment d'une éventuelle fermeture de caisse.
router.get('/recettes-jour', recettesDuJour);
router.get('/recettes-semaine', recettesSemaine);

// Réservé au Curé
router.get('/etat-recettes', reserverAuCure, etatRecettes);
router.get('/export-recettes-csv', reserverAuCure, exporterRecettesCsv);

module.exports = router;
