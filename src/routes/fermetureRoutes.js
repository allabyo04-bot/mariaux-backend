const express = require('express');
const router = express.Router();
const { verifierToken } = require('../middleware/auth');
const { obtenirPeriodeOuverte, creerFermeture, listerFermetures, obtenirDetailFermeture } = require('../controllers/fermetureController');

router.use(verifierToken);

router.get('/periode-ouverte', obtenirPeriodeOuverte);
router.get('/:id/detail', obtenirDetailFermeture);
router.get('/', listerFermetures);
router.post('/', creerFermeture);

module.exports = router;
