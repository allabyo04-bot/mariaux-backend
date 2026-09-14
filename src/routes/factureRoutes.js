const express = require('express');
const router = express.Router();
const { verifierToken } = require('../middleware/auth');
const { creerFacture, obtenirFacture, listerFactures, annulerFacture } = require('../controllers/factureController');

router.use(verifierToken);

router.get('/', listerFactures);
router.get('/:id', obtenirFacture);
router.post('/', creerFacture);
router.delete('/:id', annulerFacture);

module.exports = router;
