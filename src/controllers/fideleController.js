const prisma = require('../lib/prisma');

// Recherche par nom (autocomplétion), accessible à la Caisse
async function rechercherFideles(req, res) {
  const { q } = req.query;
  const fideles = await prisma.fidele.findMany({
    where: q ? { nom: { contains: q, mode: 'insensitive' } } : {},
    orderBy: { nom: 'asc' },
    take: 20,
  });
  res.json(fideles);
}

async function obtenirFidele(req, res) {
  const { nom } = req.params;
  const fidele = await prisma.fidele.findUnique({ where: { nom } });
  if (!fidele) return res.status(404).json({ erreur: 'Fidèle introuvable' });
  res.json(fidele);
}

// Créer ou mettre à jour un fidèle récurrent avec son intention par défaut
async function enregistrerFidele(req, res) {
  const { nom, typeIntentionParDefaut, intentionParDefaut } = req.body;
  if (!nom || !nom.trim()) return res.status(400).json({ erreur: 'Nom requis' });

  const fidele = await prisma.fidele.upsert({
    where: { nom: nom.trim() },
    update: { typeIntentionParDefaut, intentionParDefaut },
    create: { nom: nom.trim(), typeIntentionParDefaut, intentionParDefaut },
  });
  res.status(201).json(fidele);
}

module.exports = { rechercherFideles, obtenirFidele, enregistrerFidele };
