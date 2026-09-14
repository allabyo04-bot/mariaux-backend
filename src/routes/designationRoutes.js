const express = require('express');
const router = express.Router();
const { verifierToken, reserverAuCure } = require('../middleware/auth');
const {
  listerDesignations,
  creerDesignation,
  modifierDesignation,
  listerRubriques,
  creerRubrique,
} = require('../controllers/designationController');

router.use(verifierToken);

router.get('/', listerDesignations);
router.post('/', reserverAuCure, creerDesignation);
router.put('/:id', reserverAuCure, modifierDesignation);

router.get('/rubriques/liste', listerRubriques);
router.post('/rubriques', reserverAuCure, creerRubrique);

module.exports = router;
