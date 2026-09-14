const express = require('express');
const router = express.Router();
const { verifierToken } = require('../middleware/auth');
const { listerMesses, modifierDemandeMesse } = require('../controllers/messeController');

router.use(verifierToken);

router.get('/', listerMesses);
router.put('/:id', modifierDemandeMesse);

module.exports = router;
