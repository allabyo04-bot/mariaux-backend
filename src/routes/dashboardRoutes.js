const express = require('express');
const router = express.Router();
const { verifierToken, reserverAuCure } = require('../middleware/auth');
const { recettesDuJour, etatRecettes, exporterRecettesCsv } = require('../controllers/dashboardController');

router.use(verifierToken);

// Accessible aux deux rôles : la Caisse doit pouvoir voir son propre récap
// du jour, indépendamment d'une éventuelle fermeture de caisse déjà faite.
router.get('/recettes-jour', recettesDuJour);

// Réservé au Curé
router.get('/etat-recettes', reserverAuCure, etatRecettes);
router.get('/export-recettes-csv', reserverAuCure, exporterRecettesCsv);

module.exports = router;
