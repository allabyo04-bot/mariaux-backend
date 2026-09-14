const prisma = require('../lib/prisma');

const JOURS_ORDRE = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];

// getDay() : 0=dimanche, 1=lundi, ... 6=samedi
function jourSemaineDepuisDate(date) {
  const index = date.getDay();
  return index === 0 ? 'DIMANCHE' : JOURS_ORDRE[index - 1];
}

// Accessible à la Caisse : elle a besoin de la grille pour choisir une heure
async function listerHoraires(req, res) {
  const horaires = await prisma.horaireMesse.findMany({
    where: { actif: true },
    orderBy: [{ jour: 'asc' }, { heure: 'asc' }],
  });

  const parJour = {};
  for (const j of JOURS_ORDRE) parJour[j] = [];
  for (const h of horaires) parJour[h.jour].push(h.heure);

  res.json(parJour);
}

// Réservé au Curé : vue détaillée avec identifiants, pour gérer (ajouter/retirer) la grille
async function listerHorairesDetail(req, res) {
  const horaires = await prisma.horaireMesse.findMany({
    where: { actif: true },
    orderBy: [{ jour: 'asc' }, { heure: 'asc' }],
  });
  res.json(horaires);
}

// Réservé au Curé
async function creerHoraire(req, res) {
  const { jour, heure } = req.body;
  if (!jour || !heure) return res.status(400).json({ erreur: 'Jour et heure requis' });

  // upsert : si ce créneau existait déjà (même désactivé), on le réactive plutôt que d'échouer
  const horaire = await prisma.horaireMesse.upsert({
    where: { jour_heure: { jour, heure } },
    update: { actif: true },
    create: { jour, heure },
  });
  res.status(201).json(horaire);
}

async function supprimerHoraire(req, res) {
  const { id } = req.params;
  await prisma.horaireMesse.update({ where: { id }, data: { actif: false } });
  res.json({ statut: 'ok' });
}

// Utilisé par factureController pour valider qu'une heure envoyée
// correspond bien à un horaire réel de la paroisse pour ce jour-là.
async function heureEstValide(dateMesse, heureDebut) {
  const jour = jourSemaineDepuisDate(new Date(dateMesse));
  const horaire = await prisma.horaireMesse.findFirst({
    where: { jour, heure: heureDebut, actif: true },
  });
  return Boolean(horaire);
}

module.exports = { listerHoraires, listerHorairesDetail, creerHoraire, supprimerHoraire, heureEstValide };
