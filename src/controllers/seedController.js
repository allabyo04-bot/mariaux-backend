// ROUTE TEMPORAIRE - à supprimer après le premier lancement.
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

async function lancerSeed(req, res) {
  const { cle } = req.query;
  if (!cle || cle !== process.env.JWT_SECRET) {
    return res.status(403).json({ erreur: 'Clé invalide' });
  }

  const pinCureHash = await bcrypt.hash('1234', 10);
  const pinSecretariatHash = await bcrypt.hash('1234', 10);

  await prisma.utilisateur.upsert({
    where: { identifiant: 'cure' },
    update: {},
    create: { nom: 'Curé', identifiant: 'cure', pinHash: pinCureHash, role: 'CURE' },
  });

  await prisma.utilisateur.upsert({
    where: { identifiant: 'secretariat' },
    update: {},
    create: { nom: 'Secrétariat', identifiant: 'secretariat', pinHash: pinSecretariatHash, role: 'CAISSE' },
  });

  const rubriqueMesses = await prisma.rubrique.upsert({
    where: { libelle: 'Messes' },
    update: {},
    create: { libelle: 'Messes' },
  });

  const rubriqueDenier = await prisma.rubrique.upsert({
    where: { libelle: 'Denier de culte' },
    update: {},
    create: { libelle: 'Denier de culte' },
  });

  await prisma.designation.upsert({
    where: { code: 'MD' },
    update: {},
    create: { code: 'MD', libelle: 'DEMANDE DE MESSE', type: 'B', prixUnitaire: 2000, rubriqueId: rubriqueMesses.id },
  });

  await prisma.designation.upsert({
    where: { code: 'AUT4' },
    update: {},
    create: { code: 'AUT4', libelle: 'DENIER DE CULTE FEMME', type: 'A', prixUnitaire: 43000, rubriqueId: rubriqueDenier.id },
  });

  await prisma.designation.upsert({
    where: { code: 'AUT5' },
    update: {},
    create: { code: 'AUT5', libelle: 'DENIER DE CULTE HOMME', type: 'A', prixUnitaire: 43000, rubriqueId: rubriqueDenier.id },
  });

  res.json({ statut: 'Seed terminé : comptes cure/1234 et secretariat/1234 créés.' });
}

module.exports = { lancerSeed };
