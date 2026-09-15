// ROUTE TEMPORAIRE - à supprimer après le premier lancement.
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

async function creerAdmin(req, res) {
  const { cle } = req.query;
  if (!cle || cle !== process.env.JWT_SECRET) {
    return res.status(403).json({ erreur: 'Clé invalide' });
  }

  const pinHash = await bcrypt.hash('04177', 10);

  const utilisateur = await prisma.utilisateur.upsert({
    where: { identifiant: 'admin' },
    update: { pinHash, role: 'CURE', actif: true },
    create: { nom: 'Admin', identifiant: 'admin', pinHash, role: 'CURE' },
  });

  res.json({ statut: `Compte admin créé/mis à jour : identifiant "${utilisateur.identifiant}", rôle ${utilisateur.role}` });
}

module.exports = { creerAdmin };
