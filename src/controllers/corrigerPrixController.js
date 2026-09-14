// ROUTE TEMPORAIRE - à supprimer après le premier lancement.
const prisma = require('../lib/prisma');

const CODES_A_CORRIGER = ['AU1', 'ADA', 'AO', 'ADMM', 'DCA', 'DCRA', 'DF', 'PVD'];

async function corrigerPrixZero(req, res) {
  const { cle } = req.query;
  if (!cle || cle !== process.env.JWT_SECRET) {
    return res.status(403).json({ erreur: 'Clé invalide' });
  }

  const resultat = await prisma.designation.updateMany({
    where: { code: { in: CODES_A_CORRIGER } },
    data: { prixUnitaire: 500 },
  });

  res.json({ statut: `${resultat.count} désignation(s) mise(s) à 500 F.` });
}

module.exports = { corrigerPrixZero };
