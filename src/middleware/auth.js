const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-moi-en-production';

function verifierToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ erreur: 'Non authentifié' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.utilisateur = payload; // { id, nom, role }
    next();
  } catch (e) {
    return res.status(401).json({ erreur: 'Token invalide ou expiré' });
  }
}

// Le Curé a accès à tout ; réserve certaines routes à lui seul
// (ex: dashboard recettes, gestion des désignations)
function reserverAuCure(req, res, next) {
  if (req.utilisateur?.role !== 'CURE') {
    return res.status(403).json({ erreur: 'Accès réservé au Curé' });
  }
  next();
}

module.exports = { verifierToken, reserverAuCure, JWT_SECRET };
