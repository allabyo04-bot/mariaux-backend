const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { JWT_SECRET } = require('../middleware/auth');

async function connexion(req, res) {
  const { identifiant, pin } = req.body;
  if (!identifiant || !pin) {
    return res.status(400).json({ erreur: 'Identifiant et PIN requis' });
  }

  const utilisateur = await prisma.utilisateur.findUnique({ where: { identifiant } });
  if (!utilisateur || !utilisateur.actif) {
    return res.status(401).json({ erreur: 'Identifiants incorrects' });
  }

  const pinValide = await bcrypt.compare(pin, utilisateur.pinHash);
  if (!pinValide) {
    return res.status(401).json({ erreur: 'Identifiants incorrects' });
  }

  const token = jwt.sign(
    { id: utilisateur.id, nom: utilisateur.nom, role: utilisateur.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    utilisateur: { id: utilisateur.id, nom: utilisateur.nom, role: utilisateur.role },
  });
}

module.exports = { connexion };
