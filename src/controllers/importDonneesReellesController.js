// ROUTE TEMPORAIRE - à supprimer après le premier lancement.
// Importe les vraies données de Mariaux depuis les fichiers Excel de l'ancien
// logiciel : grille d'horaires, désignations (avec leurs rubriques), et un
// ajustement des recettes du mois en cours par rubrique.
const prisma = require('../lib/prisma');
const designationsData = require('../scripts/data/designations_mariaux.json');
const horairesData = require('../scripts/data/horaires_mariaux.json');
const recettesData = require('../scripts/data/recettes_mois_mariaux.json');

const CODES_PLACEHOLDER_A_DESACTIVER = ['MD', 'AUT4', 'AUT5']; // désignations du seed initial générique

async function genererNumero() {
  const annee = new Date().getFullYear().toString().slice(-2);
  const dernier = await prisma.facture.findFirst({ orderBy: { createdAt: 'desc' } });
  let compteur = 1;
  if (dernier) {
    const [num] = dernier.numero.split('/');
    compteur = parseInt(num, 10) + 1;
  }
  return `${compteur}/${annee}`;
}

async function lancerImportDonneesReelles(req, res) {
  const { cle } = req.query;
  if (!cle || cle !== process.env.JWT_SECRET) {
    return res.status(403).json({ erreur: 'Clé invalide' });
  }

  try {
    // 1. Désactive les désignations placeholder du seed initial (codes réutilisés différemment)
    await prisma.designation.updateMany({
      where: { code: { in: CODES_PLACEHOLDER_A_DESACTIVER } },
      data: { actif: false },
    });

    // 2. Rubriques (upsert par libellé)
    const rubriquesUniques = [...new Set(designationsData.map((d) => d.rubrique))];
    const rubriqueParNom = {};
    for (const nom of rubriquesUniques) {
      const r = await prisma.rubrique.upsert({
        where: { libelle: nom },
        update: {},
        create: { libelle: nom },
      });
      rubriqueParNom[nom] = r.id;
    }

    // 3. Désignations (upsert par code)
    let designationsImportees = 0;
    for (const d of designationsData) {
      await prisma.designation.upsert({
        where: { code: d.code },
        update: {
          libelle: d.libelle,
          type: d.type,
          prixUnitaire: d.prixUnitaire,
          rubriqueId: rubriqueParNom[d.rubrique],
          actif: true,
        },
        create: {
          code: d.code,
          libelle: d.libelle,
          type: d.type,
          prixUnitaire: d.prixUnitaire,
          rubriqueId: rubriqueParNom[d.rubrique],
        },
      });
      designationsImportees += 1;
    }

    // 4. Horaires (upsert par jour+heure)
    let horairesImportes = 0;
    for (const h of horairesData) {
      await prisma.horaireMesse.upsert({
        where: { jour_heure: { jour: h.jour, heure: h.heure } },
        update: { actif: true },
        create: { jour: h.jour, heure: h.heure },
      });
      horairesImportes += 1;
    }

    // 5. Recettes du mois par rubrique : une désignation d'ajustement par rubrique
    // + une facture à 0 F ne servant qu'à faire apparaître ces montants dans
    // le Tableau de bord / État des recettes du mois en cours.
    const cure = await prisma.utilisateur.findFirst({ where: { role: 'CURE', actif: true } });
    if (!cure) throw new Error('Aucun compte Curé actif trouvé');

    const lignesRecettes = [];
    for (const [nomRubrique, montant] of Object.entries(recettesData)) {
      const codeAjustement = `REPORT-${nomRubrique.slice(0, 8).toUpperCase().replace(/[^A-Z]/g, '')}`;
      const designationAjustement = await prisma.designation.upsert({
        where: { code: codeAjustement },
        update: { prixUnitaire: montant, rubriqueId: rubriqueParNom[nomRubrique] },
        create: {
          code: codeAjustement,
          libelle: `Report recettes du mois — ${nomRubrique}`,
          type: 'A',
          prixUnitaire: montant,
          rubriqueId: rubriqueParNom[nomRubrique],
        },
      });
      lignesRecettes.push({ designationId: designationAjustement.id, quantite: 1, prixUnitaire: montant, montant });
    }

    const montantTotal = lignesRecettes.reduce((s, l) => s + l.montant, 0);
    const numero = await genererNumero();
    await prisma.facture.create({
      data: {
        numero,
        fidele: 'Import (registre)',
        etablitParId: cure.id,
        montantTotal,
        remise: 0,
        netAPayer: montantTotal,
        lignes: { create: lignesRecettes },
      },
    });

    res.json({
      statut: 'Import terminé',
      designationsImportees,
      horairesImportes,
      recettesImportees: recettesData,
      totalRecettes: montantTotal,
    });
  } catch (e) {
    console.error('Erreur import donnees reelles Mariaux :', e);
    res.status(500).json({ erreur: e.message });
  }
}

module.exports = { lancerImportDonneesReelles };
