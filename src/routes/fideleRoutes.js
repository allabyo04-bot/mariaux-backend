const express = require('express');
const router = express.Router();
const { verifierToken } = require('../middleware/auth');
const { rechercherFideles, obtenirFidele, enregistrerFidele } = require('../controllers/fideleController');

router.use(verifierToken);

router.get('/', rechercherFideles);
router.get('/:nom', obtenirFidele);
router.post('/', enregistrerFidele);

module.exports = router;
