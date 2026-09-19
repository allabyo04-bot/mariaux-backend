const prisma = require('../lib/prisma');

async function sommeExcedents(where) {
  const factures = await prisma.facture.findMany({
    where,
    select: { montantRecu: true, netAPayer: true },
  });
  return factures.reduce((somme, f) => {
    if (f.montantRecu === null) return somme;
    const excedent = Number(f.montantRecu) - Number(f.netAPayer);
    return somme + (excedent > 0 ? excedent : 0);
  }, 0);
}

// Regroupe des lignes de facture par désignation : nombre réalisé + montant total,
// pour le détail attendu par la Caisse ("DEMANDE DE MESSE : 48 x 2000 F = 96000 F").
function regrouperParDesignation(lignes) {
  const parDesignation = {};
  for (const l of lignes) {
    const libelle = l.designation.libelle;
    if (!parDesignation[libelle]) {
      parDesignation[libelle] = { libelle, quantite: 0, montant: 0 };
    }
    parDesignation[libelle].quantite += Number(l.quantite);
    parDesignation[libelle].montant += Number(l.montant);
  }
  return Object.values(parDesignation).sort((a, b) => b.montant - a.montant);
}

async function recettesDuJour(req, res) {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  const fin = new Date();
  fin.setHours(23, 59, 59, 999);

  const lignes = await prisma.ligneFacture.findMany({
    where: { facture: { date: { gte: debut, lte: fin } } },
    include: { designation: { include: { rubrique: true } } },
  });

  const parRubrique = {};
  let totalJour = 0;
  for (const l of lignes) {
    const nomRubrique = l.designation.rubrique?.libelle || 'Sans rubrique';
    const montant = Number(l.montant);
    parRubrique[nomRubrique] = (parRubrique[nomRubrique] || 0) + montant;
    totalJour += montant;
  }
  const parDesignation = regrouperParDesignation(lignes);

  const excedentJour = await sommeExcedents({ date: { gte: debut, lte: fin } });
  if (excedentJour > 0) {
    parRubrique['Dons complémentaires'] = (parRubrique['Dons complémentaires'] || 0) + excedentJour;
    totalJour += excedentJour;
  }

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);

  // Semaine en cours : du lundi (00h00) au samedi (23h59), fin du service
  const debutSemaine = new Date();
  const jourSemaine = debutSemaine.getDay(); // 0 = dimanche
  const decalageLundi = jourSemaine === 0 ? -6 : 1 - jourSemaine;
  debutSemaine.setDate(debutSemaine.getDate() + decalageLundi);
  debutSemaine.setHours(0, 0, 0, 0);
  const finSemaine = new Date(debutSemaine);
  finSemaine.setDate(debutSemaine.getDate() + 5); // samedi
  finSemaine.setHours(23, 59, 59, 999);

  const cumulSemaineAgg = await prisma.ligneFacture.aggregate({
    where: { facture: { date: { gte: debutSemaine, lte: finSemaine } } },
    _sum: { montant: true },
  });
  const excedentSemaine = await sommeExcedents({ date: { gte: debutSemaine, lte: finSemaine } });

  const cumulMoisAgg = await prisma.ligneFacture.aggregate({
    where: { facture: { date: { gte: debutMois } } },
    _sum: { montant: true },
  });

  const excedentMois = await sommeExcedents({ date: { gte: debutMois } });

  res.json({
    parRubrique: Object.entries(parRubrique).map(([rubrique, montant]) => ({ rubrique, montant })),
    parDesignation,
    totalJour,
    cumulSemaine: Number(cumulSemaineAgg._sum.montant || 0) + excedentSemaine,
    cumulMois: Number(cumulMoisAgg._sum.montant || 0) + excedentMois,
  });
}

// État des recettes regroupées par jour, mois ou année, sur une période donnée,
// avec un récapitulatif par rubrique pour l'ensemble de la période (pour le
// compte-rendu du Curé à sa hiérarchie).
async function etatRecettes(req, res) {
  const { debut, fin, granularite } = req.query;
  if (!debut || !fin) {
    return res.status(400).json({ erreur: 'Début et fin de période requis' });
  }

  const dateDebut = new Date(debut);
  const dateFin = new Date(`${fin}T23:59:59`);

  const factures = await prisma.facture.findMany({
    where: { date: { gte: dateDebut, lte: dateFin } },
    select: { date: true, netAPayer: true, montantRecu: true },
  });

  const groupes = {};
  for (const f of factures) {
    const d = f.date;
    let cle;
    if (granularite === 'annee') {
      cle = `${d.getFullYear()}`;
    } else if (granularite === 'mois') {
      cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else {
      cle = d.toISOString().slice(0, 10);
    }

    const net = Number(f.netAPayer);
    const excedent = f.montantRecu !== null && Number(f.montantRecu) > net ? Number(f.montantRecu) - net : 0;
    groupes[cle] = (groupes[cle] || 0) + net + excedent;
  }

  const resultat = Object.entries(groupes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periode, montant]) => ({ periode, montant }));

  const total = resultat.reduce((s, r) => s + r.montant, 0);

  // Récapitulatif par rubrique sur toute la période
  const lignes = await prisma.ligneFacture.findMany({
    where: { facture: { date: { gte: dateDebut, lte: dateFin } } },
    include: { designation: { include: { rubrique: true } } },
  });

  const parRubrique = {};
  for (const l of lignes) {
    const nomRubrique = l.designation.rubrique?.libelle || 'Sans rubrique';
    parRubrique[nomRubrique] = (parRubrique[nomRubrique] || 0) + Number(l.montant);
  }

  const excedentTotal = factures.reduce((s, f) => {
    if (f.montantRecu === null) return s;
    const net = Number(f.netAPayer);
    const e = Number(f.montantRecu) - net;
    return s + (e > 0 ? e : 0);
  }, 0);
  if (excedentTotal > 0) {
    parRubrique['Dons complémentaires'] = (parRubrique['Dons complémentaires'] || 0) + excedentTotal;
  }

  const recapRubriques = Object.entries(parRubrique)
    .sort(([, a], [, b]) => b - a)
    .map(([rubrique, montant]) => ({ rubrique, montant }));

  res.json({ resultat, total, recapRubriques });
}

// Export CSV détaillé (ligne par ligne) des recettes sur une période, pour Excel/comptabilité.
async function exporterRecettesCsv(req, res) {
  const { debut, fin } = req.query;
  if (!debut || !fin) {
    return res.status(400).json({ erreur: 'Début et fin de période requis' });
  }

  const factures = await prisma.facture.findMany({
    where: { date: { gte: new Date(debut), lte: new Date(`${fin}T23:59:59`) } },
    include: { lignes: { include: { designation: { include: { rubrique: true } } } } },
    orderBy: { date: 'asc' },
  });

  const entetes = ['Date', 'Recu N', 'Fidele', 'Designation', 'Rubrique', 'Quantite', 'Montant'];
  const lignesCsv = [entetes.join(';')];

  function echapper(valeur) {
    const s = String(valeur ?? '');
    return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  }

  for (const f of factures) {
    const dateStr = f.date.toISOString().slice(0, 10);
    for (const l of f.lignes) {
      lignesCsv.push([
        dateStr,
        f.numero,
        echapper(f.fidele),
        echapper(l.designation.libelle),
        echapper(l.designation.rubrique?.libelle || 'Sans rubrique'),
        Number(l.quantite),
        Number(l.montant),
      ].join(';'));
    }

    const net = Number(f.netAPayer);
    const excedent = f.montantRecu !== null && Number(f.montantRecu) > net ? Number(f.montantRecu) - net : 0;
    if (excedent > 0) {
      lignesCsv.push([dateStr, f.numero, echapper(f.fidele), 'Don complémentaire', 'Dons complémentaires', 1, excedent].join(';'));
    }
  }

  const csv = '\uFEFF' + lignesCsv.join('\r\n'); // BOM UTF-8 pour Excel

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="recettes_${debut}_${fin}.csv"`);
  res.send(csv);
}

// Récap de la semaine en cours (lundi 00h00 au samedi 23h59), par rubrique —
// accessible à la Caisse pour son propre bilan hebdomadaire imprimable.
async function recettesSemaine(req, res) {
  const debutSemaine = new Date();
  const jourSemaine = debutSemaine.getDay(); // 0 = dimanche
  const decalageLundi = jourSemaine === 0 ? -6 : 1 - jourSemaine;
  debutSemaine.setDate(debutSemaine.getDate() + decalageLundi);
  debutSemaine.setHours(0, 0, 0, 0);
  const finSemaine = new Date(debutSemaine);
  finSemaine.setDate(debutSemaine.getDate() + 5); // samedi
  finSemaine.setHours(23, 59, 59, 999);

  const where = { facture: { date: { gte: debutSemaine, lte: finSemaine } } };

  const lignes = await prisma.ligneFacture.findMany({
    where,
    include: { designation: { include: { rubrique: true } } },
  });

  const parRubrique = {};
  let totalSemaine = 0;
  for (const l of lignes) {
    const nomRubrique = l.designation.rubrique?.libelle || 'Sans rubrique';
    const montant = Number(l.montant);
    parRubrique[nomRubrique] = (parRubrique[nomRubrique] || 0) + montant;
    totalSemaine += montant;
  }
  const parDesignation = regrouperParDesignation(lignes);

  const excedentSemaine = await sommeExcedents({ date: { gte: debutSemaine, lte: finSemaine } });
  if (excedentSemaine > 0) {
    parRubrique['Dons complémentaires'] = (parRubrique['Dons complémentaires'] || 0) + excedentSemaine;
    totalSemaine += excedentSemaine;
  }

  const nombreFactures = await prisma.facture.count({ where: { date: { gte: debutSemaine, lte: finSemaine } } });

  res.json({
    dateDebut: debutSemaine,
    dateFin: finSemaine,
    nombreFactures,
    totalSemaine,
    parRubrique: Object.entries(parRubrique).map(([rubrique, montant]) => ({ rubrique, montant })),
    parDesignation,
  });
}

module.exports = { recettesDuJour, recettesSemaine, etatRecettes, exporterRecettesCsv };
