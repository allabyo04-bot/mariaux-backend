const prisma = require('../lib/prisma');
const { heureEstValide } = require('./horaireController');

function debutAujourdhui() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function finAujourdhui() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// Génère un numéro du type 13579/23 (compteur global + 2 derniers chiffres de l'année)
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

// Body attendu :
// {
//   fidele: "FIDELE",
//   montantRecu: 5000,        // optionnel — ce que le fidèle a réellement donné
//   lignes: [
//     { designationId, quantite },                          // désignation Type A
//     { designationId,                                       // désignation Type B
//       demandeMesse: {
//         typeIntention, intention,
//         dates: [ { dateMesse, heureDebut }, ... ]           // 1 date = messe unique, plusieurs = période/neuvaine
//       }
//     }
//   ],
//   remise: 0
// }
async function creerFacture(req, res) {
  const { fidele, lignes, remise, montantRecu } = req.body;

  if (!fidele || !Array.isArray(lignes) || lignes.length === 0) {
    return res.status(400).json({ erreur: 'Fidèle et au moins une ligne sont requis' });
  }

  const designationIds = lignes.map((l) => l.designationId);
  const designations = await prisma.designation.findMany({
    where: { id: { in: designationIds } },
  });
  const designationParId = Object.fromEntries(designations.map((d) => [d.id, d]));

  for (const ligne of lignes) {
    const d = designationParId[ligne.designationId];
    if (!d) return res.status(400).json({ erreur: `Désignation inconnue : ${ligne.designationId}` });

    if (d.type === 'B') {
      const dm = ligne.demandeMesse;
      if (!dm || !Array.isArray(dm.dates) || dm.dates.length === 0) {
        return res.status(400).json({
          erreur: `La désignation "${d.libelle}" est de Type B : au moins une date/heure de messe est requise`,
        });
      }
      for (const occ of dm.dates) {
        const valide = await heureEstValide(occ.dateMesse, occ.heureDebut);
        if (!valide) {
          return res.status(400).json({
            erreur: `L'heure ${occ.heureDebut} n'existe pas dans la grille des messes pour le ${occ.dateMesse}`,
          });
        }
      }
    }
  }

  const numero = await genererNumero();

  let montantTotal = 0;
  const lignesData = lignes.map((ligne) => {
    const d = designationParId[ligne.designationId];
    // Pour Type B, la quantité = nombre de dates demandées (ex : neuvaine = 9)
    const quantite = d.type === 'B' ? ligne.demandeMesse.dates.length : Number(ligne.quantite) || 1;
    const prixUnitaire = Number(d.prixUnitaire);
    const montant = quantite * prixUnitaire;
    montantTotal += montant;
    return { ligne, d, quantite, prixUnitaire, montant };
  });

  const netAPayer = montantTotal - (Number(remise) || 0);
  const recu = montantRecu !== undefined && montantRecu !== null && montantRecu !== '' ? Number(montantRecu) : null;
  const excedent = recu !== null && recu > netAPayer ? recu - netAPayer : 0;

  const facture = await prisma.facture.create({
    data: {
      numero,
      fidele,
      etablitParId: req.utilisateur.id,
      montantTotal,
      remise: remise || 0,
      netAPayer,
      montantRecu: recu,
      lignes: {
        create: lignesData.map(({ ligne, d, quantite, prixUnitaire, montant }) => ({
          designationId: d.id,
          quantite,
          prixUnitaire,
          montant,
          ...(d.type === 'B'
            ? {
                demandesMesse: {
                  create: ligne.demandeMesse.dates.map((occ) => ({
                    typeIntention: ligne.demandeMesse.typeIntention,
                    intention: ligne.demandeMesse.intention,
                    dateMesse: new Date(occ.dateMesse),
                    heureDebut: occ.heureDebut,
                  })),
                },
              }
            : {}),
        })),
      },
    },
    include: {
      lignes: { include: { designation: true, demandesMesse: true } },
      etablitPar: { select: { nom: true } },
    },
  });

  res.status(201).json({ ...facture, excedent });
}

async function obtenirFacture(req, res) {
  const { id } = req.params;
  const facture = await prisma.facture.findUnique({
    where: { id },
    include: {
      lignes: { include: { designation: true, demandesMesse: true } },
      etablitPar: { select: { nom: true } },
    },
  });
  if (!facture) return res.status(404).json({ erreur: 'Facture introuvable' });

  const excedent =
    facture.montantRecu !== null && Number(facture.montantRecu) > Number(facture.netAPayer)
      ? Number(facture.montantRecu) - Number(facture.netAPayer)
      : 0;

  res.json({ ...facture, excedent });
}

// La Caisse ne voit que les factures du jour (la fermeture de caisse a été
// abandonnée au profit d'un simple récap imprimable du jour). Le Curé peut
// filtrer par période, numéro ou nom du fidèle, sans restriction.
async function listerFactures(req, res) {
  const estCaisse = req.utilisateur.role === 'CAISSE';
  let where = {};

  if (estCaisse) {
    where.date = { gte: debutAujourdhui(), lte: finAujourdhui() };
  } else {
    if (req.query.debut && req.query.fin) {
      where.date = { gte: new Date(req.query.debut), lte: new Date(`${req.query.fin}T23:59:59`) };
    }
    if (req.query.numero) {
      where.numero = { contains: req.query.numero };
    }
    if (req.query.fidele) {
      where.fidele = { contains: req.query.fidele, mode: 'insensitive' };
    }
  }

  const factures = await prisma.facture.findMany({
    where,
    include: { lignes: { include: { designation: true } } },
    orderBy: { createdAt: 'desc' },
    take: estCaisse ? undefined : 100,
  });
  res.json(factures);
}

// Annule (supprime) une facture — la Caisse ne peut annuler qu'une facture du
// jour même ; le Curé peut annuler n'importe quelle facture. Les lignes et
// demandes de messe liées disparaissent avec (onDelete: Cascade dans le schéma).
async function annulerFacture(req, res) {
  const { id } = req.params;
  const facture = await prisma.facture.findUnique({ where: { id } });
  if (!facture) return res.status(404).json({ erreur: 'Facture introuvable' });

  if (req.utilisateur.role === 'CAISSE') {
    if (facture.date < debutAujourdhui()) {
      return res.status(403).json({ erreur: "Cette facture n'est pas d'aujourd'hui — seul le Curé peut y toucher" });
    }
  }

  await prisma.facture.delete({ where: { id } });
  res.json({ statut: 'ok' });
}

module.exports = { creerFacture, obtenirFacture, listerFactures, annulerFacture };
