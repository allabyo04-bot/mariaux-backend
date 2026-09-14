const prisma = require('../lib/prisma');
const { heureEstValide } = require('./horaireController');

// Listing des messes demandées pour une date donnée (ou une période),
// équivalent à "Listing des messes demandées" dans LOGESPAC desktop.
async function listerMesses(req, res) {
  const { date, debut, fin } = req.query;

  let where = {};
  if (date) {
    const jour = new Date(date);
    const debutJour = new Date(jour.setHours(0, 0, 0, 0));
    const finJour = new Date(jour.setHours(23, 59, 59, 999));
    where.dateMesse = { gte: debutJour, lte: finJour };
  } else if (debut && fin) {
    where.dateMesse = { gte: new Date(debut), lte: new Date(fin) };
  }

  const messes = await prisma.demandeMesse.findMany({
    where,
    include: {
      ligneFacture: {
        include: { facture: { select: { numero: true, fidele: true, date: true } } },
      },
    },
    orderBy: [{ dateMesse: 'asc' }, { heureDebut: 'asc' }],
  });

  res.json(
    messes.map((m) => ({
      id: m.id,
      dateMesse: m.dateMesse,
      heureDebut: m.heureDebut,
      typeIntention: m.typeIntention,
      intention: m.intention,
      fidele: m.ligneFacture.facture.fidele,
      numeroFacture: m.ligneFacture.facture.numero,
    }))
  );
}

// Corrige la date/heure d'une demande de messe déjà enregistrée (et déjà payée),
// sans toucher au reçu ni au montant — utile si la Caisse s'est trompée
// d'horaire ou de date en saisissant la demande initiale.
async function modifierDemandeMesse(req, res) {
  const { id } = req.params;
  const { dateMesse, heureDebut } = req.body;

  if (!dateMesse || !heureDebut) {
    return res.status(400).json({ erreur: 'Date et heure requises' });
  }

  const valide = await heureEstValide(dateMesse, heureDebut);
  if (!valide) {
    return res.status(400).json({ erreur: `L'heure ${heureDebut} n'existe pas dans la grille des messes pour cette date` });
  }

  const existante = await prisma.demandeMesse.findUnique({ where: { id } });
  if (!existante) return res.status(404).json({ erreur: 'Demande de messe introuvable' });

  const misAJour = await prisma.demandeMesse.update({
    where: { id },
    data: { dateMesse: new Date(`${dateMesse}T12:00:00`), heureDebut },
  });

  res.json(misAJour);
}

module.exports = { listerMesses, modifierDemandeMesse };
