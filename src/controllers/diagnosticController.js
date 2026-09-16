// ROUTE TEMPORAIRE - à supprimer après diagnostic.
const prisma = require('../lib/prisma');

async function diagnosticFermetures(req, res) {
  const { cle } = req.query;
  if (!cle || cle !== process.env.JWT_SECRET) {
    return res.status(403).json({ erreur: 'Clé invalide' });
  }

  const fermetures = await prisma.fermetureCaisse.findMany({
    orderBy: { dateFin: 'desc' },
    take: 10,
    include: { faitPar: { select: { nom: true, identifiant: true } } },
  });

  const maintenant = new Date();

  res.json({
    maintenant: maintenant.toISOString(),
    dernieresFermetures: fermetures.map((f) => ({
      id: f.id,
      dateDebut: f.dateDebut.toISOString(),
      dateFin: f.dateFin.toISOString(),
      nombreFactures: f.nombreFactures,
      totalNetAPayer: Number(f.totalNetAPayer),
      faitPar: f.faitPar?.identifiant,
      createdAt: f.createdAt.toISOString(),
    })),
  });
}

module.exports = { diagnosticFermetures };
