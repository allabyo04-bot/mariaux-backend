const express = require('express');
const router = express.Router();
const { verifierToken, reserverAuCure } = require('../middleware/auth');
const { listerHoraires, listerHorairesDetail, creerHoraire, supprimerHoraire } = require('../controllers/horaireController');

router.use(verifierToken);

router.get('/', listerHoraires);
router.get('/detail', reserverAuCure, listerHorairesDetail);
router.post('/', reserverAuCure, creerHoraire);
router.delete('/:id', reserverAuCure, supprimerHoraire);

module.exports = router;
