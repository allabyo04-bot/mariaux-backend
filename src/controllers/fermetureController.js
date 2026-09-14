const prisma = require('../lib/prisma');

// Date de départ très ancienne, utilisée seulement quand il n'y a encore
// jamais eu de fermeture (couvre alors tout l'historique).
const DATE_ORIGINE = new Date('2000-01-01T00:00:00');

async function derniereFermeture() {
  return prisma.fermetureCaisse.findFirst({ orderBy: { dateFin: 'desc' } });
}

// Renvoie le résumé de la période actuellement ouverte (depuis la dernière
// fermeture, ou depuis le début s'il n'y en a jamais eu).
async function obtenirPeriodeOuverte(req, res) {
  const derniere = await derniereFermeture();
  const dateDebut = derniere ? derniere.dateFin : DATE_ORIGINE;
  const dateFin = new Date();

  const factures = await prisma.facture.findMany({
    where: { date: { gt: dateDebut, lte: dateFin } },
    select: { netAPayer: true, montantRecu: true },
  });

  let totalNetAPayer = 0;
  let totalExcedent = 0;
  for (const f of factures) {
    const net = Number(f.netAPayer);
    totalNetAPayer += net;
    if (f.montantRecu !== null && Number(f.montantRecu) > net) {
      totalExcedent += Number(f.montantRecu) - net;
    }
  }

  res.json({
    dateDebut,
    dateFin,
    nombreFactures: factures.length,
    totalNetAPayer,
    totalExcedent,
    total: totalNetAPayer + totalExcedent,
  });
}

// Déclenche la fermeture : fige la période ouverte actuelle dans un
// enregistrement définitif. Après ça, la Caisse ne verra plus ces factures
// (seul le Curé garde un accès complet via l'Historique).
async function creerFermeture(req, res) {
  const derniere = await derniereFermeture();
  const dateDebut = derniere ? derniere.dateFin : DATE_ORIGINE;
  const dateFin = new Date();

  const factures = await prisma.facture.findMany({
    where: { date: { gt: dateDebut, lte: dateFin } },
    select: { netAPayer: true, montantRecu: true },
  });

  if (factures.length === 0) {
    return res.status(400).json({ erreur: 'Aucune facture à fermer depuis la dernière fermeture' });
  }

  let totalNetAPayer = 0;
  let totalExcedent = 0;
  for (const f of factures) {
    const net = Number(f.netAPayer);
    totalNetAPayer += net;
    if (f.montantRecu !== null && Number(f.montantRecu) > net) {
      totalExcedent += Number(f.montantRecu) - net;
    }
  }

  const fermeture = await prisma.fermetureCaisse.create({
    data: {
      dateDebut,
      dateFin,
      nombreFactures: factures.length,
      totalNetAPayer,
      totalExcedent,
      faitParId: req.utilisateur.id,
    },
    include: { faitPar: { select: { nom: true } } },
  });

  res.status(201).json(fermeture);
}

// Historique des fermetures (accessible aux deux rôles)
async function listerFermetures(req, res) {
  const fermetures = await prisma.fermetureCaisse.findMany({
    include: { faitPar: { select: { nom: true } } },
    orderBy: { dateFin: 'desc' },
    take: 100,
  });
  res.json(fermetures);
}

module.exports = { obtenirPeriodeOuverte, creerFermeture, listerFermetures, derniereFermeture };
