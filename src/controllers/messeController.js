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
      _count: { select: { corrections: true } },
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
      nombreCorrections: m._count.corrections,
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

// Corrige le texte d'une intention déjà enregistrée (faute de frappe, etc.).
// - La Caisse : une seule correction autorisée par intention, et seulement
//   tant que la messe n'a pas encore eu lieu.
// - Le Curé : aucune limite (ni de nombre, ni de date).
// Chaque correction est journalisée avec un motif obligatoire.
async function corrigerIntention(req, res) {
  const { id } = req.params;
  const { nouvelleIntention, motif } = req.body;

  if (!nouvelleIntention || !nouvelleIntention.trim()) {
    return res.status(400).json({ erreur: 'La nouvelle intention est requise' });
  }
  if (!motif || !motif.trim()) {
    return res.status(400).json({ erreur: 'Le motif de la correction est requis' });
  }

  const demandeMesse = await prisma.demandeMesse.findUnique({
    where: { id },
    include: { _count: { select: { corrections: true } } },
  });
  if (!demandeMesse) return res.status(404).json({ erreur: 'Demande de messe introuvable' });

  if (req.utilisateur.role === 'CAISSE') {
    if (demandeMesse.dateMesse < new Date()) {
      return res.status(403).json({ erreur: 'Cette messe a déjà eu lieu — seul le Curé peut encore corriger cette intention' });
    }
    if (demandeMesse._count.corrections >= 1) {
      return res.status(403).json({ erreur: 'Cette intention a déjà été corrigée une fois — seul le Curé peut la corriger à nouveau' });
    }
  }

  const [, misAJour] = await prisma.$transaction([
    prisma.correctionIntention.create({
      data: {
        demandeMesseId: id,
        ancienneIntention: demandeMesse.intention,
        nouvelleIntention: nouvelleIntention.trim(),
        motif: motif.trim(),
        faitParId: req.utilisateur.id,
      },
    }),
    prisma.demandeMesse.update({
      where: { id },
      data: { intention: nouvelleIntention.trim() },
    }),
  ]);

  res.json(misAJour);
}

// Journal des corrections d'intention — réservé au Curé
async function listerCorrectionsIntention(req, res) {
  const corrections = await prisma.correctionIntention.findMany({
    include: {
      faitPar: { select: { nom: true } },
      demandeMesse: { select: { dateMesse: true, heureDebut: true, typeIntention: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(corrections);
}

module.exports = { listerMesses, modifierDemandeMesse, corrigerIntention, listerCorrectionsIntention };
