// ROUTE TEMPORAIRE - à supprimer après le premier lancement.
const prisma = require('../lib/prisma');

async function genererCode() {
  const total = await prisma.designation.count();
  let compteur = total + 1;
  for (let essai = 0; essai < 50; essai++) {
    const code = `D${String(compteur).padStart(3, '0')}`;
    const existe = await prisma.designation.findUnique({ where: { code } });
    if (!existe) return code;
    compteur++;
  }
  return `D${Date.now()}`;
}

async function ajusterTarifs(req, res) {
  const { cle } = req.query;
  if (!cle || cle !== process.env.JWT_SECRET) {
    return res.status(403).json({ erreur: 'Clé invalide' });
  }

  try {
    const maj1 = await prisma.designation.update({ where: { code: 'FDB' }, data: { prixUnitaire: 7000 } });
    const maj2 = await prisma.designation.update({ where: { code: 'FDM' }, data: { prixUnitaire: 10000 } });
    const maj3 = await prisma.designation.update({ where: { code: 'DL' }, data: { prixUnitaire: 5000 } });

    const desactive1 = await prisma.designation.update({ where: { code: 'PH' }, data: { actif: false } });
    const desactive2 = await prisma.designation.update({ where: { code: 'CAM' }, data: { actif: false } });

    const rubriqueDossier = await prisma.rubrique.findUnique({ where: { libelle: 'Dossier Administratif' } });
    const code = await genererCode();
    const nouvelle = await prisma.designation.create({
      data: {
        code,
        libelle: 'COPIE CONFORME DU LIVRET',
        type: 'A',
        prixUnitaire: 2000,
        rubriqueId: rubriqueDossier?.id || null,
      },
    });

    res.json({
      statut: 'Ajustement terminé',
      misAJour: [
        { code: maj1.code, libelle: maj1.libelle, prix: Number(maj1.prixUnitaire) },
        { code: maj2.code, libelle: maj2.libelle, prix: Number(maj2.prixUnitaire) },
        { code: maj3.code, libelle: maj3.libelle, prix: Number(maj3.prixUnitaire) },
      ],
      desactivees: [desactive1.libelle, desactive2.libelle],
      creee: { code: nouvelle.code, libelle: nouvelle.libelle, prix: Number(nouvelle.prixUnitaire) },
    });
  } catch (e) {
    console.error('Erreur ajustement tarifs Mariaux :', e);
    res.status(500).json({ erreur: e.message });
  }
}

module.exports = { ajusterTarifs };
