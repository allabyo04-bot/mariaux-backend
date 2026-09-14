const prisma = require('../lib/prisma');

// Accessible aux deux rôles : la Caisse doit pouvoir choisir une désignation
// pour facturer, même si elle ne peut pas les créer/modifier.
// ?tous=1 inclut aussi les désignations désactivées (utilisé par l'écran de gestion du Curé)
async function listerDesignations(req, res) {
  const inclureInactifs = req.query.tous === '1' && req.utilisateur.role === 'CURE';
  const designations = await prisma.designation.findMany({
    where: inclureInactifs ? {} : { actif: true },
    include: { rubrique: true },
    orderBy: { libelle: 'asc' },
  });
  res.json(designations);
}

// Génère un code court et unique du type D001, D002... indépendant de ce que
// tape le Curé — plus besoin d'y penser en créant une désignation.
async function genererCodeDesignation() {
  const total = await prisma.designation.count();
  let compteur = total + 1;
  for (let essai = 0; essai < 20; essai++) {
    const code = `D${String(compteur).padStart(3, '0')}`;
    const existe = await prisma.designation.findUnique({ where: { code } });
    if (!existe) return code;
    compteur++;
  }
  // filet de sécurité improbable : suffixe temporel si 20 collisions d'affilée
  return `D${Date.now()}`;
}

// Réservé au Curé
async function creerDesignation(req, res) {
  const { libelle, type, prixUnitaire, rubriqueId } = req.body;
  if (!libelle || !type) {
    return res.status(400).json({ erreur: 'Libellé et type requis' });
  }
  if (!['A', 'B'].includes(type)) {
    return res.status(400).json({ erreur: 'Type doit être A ou B' });
  }

  try {
    const code = await genererCodeDesignation();
    const designation = await prisma.designation.create({
      data: { code, libelle, type, prixUnitaire: prixUnitaire || 0, rubriqueId: rubriqueId || null },
    });
    res.status(201).json(designation);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ erreur: 'Conflit de code, réessaie' });
    throw e;
  }
}

async function modifierDesignation(req, res) {
  const { id } = req.params;
  const { libelle, prixUnitaire, rubriqueId, actif } = req.body;

  const designation = await prisma.designation.update({
    where: { id },
    data: { libelle, prixUnitaire, rubriqueId, actif },
  });
  res.json(designation);
}

async function listerRubriques(req, res) {
  const rubriques = await prisma.rubrique.findMany({ orderBy: { libelle: 'asc' } });
  res.json(rubriques);
}

async function creerRubrique(req, res) {
  const { libelle } = req.body;
  if (!libelle) return res.status(400).json({ erreur: 'Libellé requis' });
  try {
    const rubrique = await prisma.rubrique.create({ data: { libelle } });
    res.status(201).json(rubrique);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ erreur: `La rubrique "${libelle}" existe déjà` });
    throw e;
  }
}

module.exports = {
  listerDesignations,
  creerDesignation,
  modifierDesignation,
  listerRubriques,
  creerRubrique,
};
