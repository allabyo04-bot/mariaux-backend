const express = require('express');
const router = express.Router();
const { verifierToken, reserverAuCure } = require('../middleware/auth');
const {
  listerUtilisateurs,
  creerUtilisateur,
  modifierUtilisateur,
  reinitialiserPin,
  changerMonPin,
} = require('../controllers/utilisateurController');

router.use(verifierToken);

router.put('/moi/pin', changerMonPin); // accessible à tout utilisateur connecté

router.get('/', reserverAuCure, listerUtilisateurs);
router.post('/', reserverAuCure, creerUtilisateur);
router.put('/:id', reserverAuCure, modifierUtilisateur);
router.put('/:id/pin', reserverAuCure, reinitialiserPin);

module.exports = router;
