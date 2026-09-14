// ROUTE TEMPORAIRE - à supprimer après le premier lancement.
const prisma = require('../lib/prisma');
const donnees = require('../scripts/data/messes_mariaux_import.json');

let etatImport = { enCours: false, termine: false, facturesCreees: 0, intentionsCreees: 0, erreurs: [], erreurGenerale: null };

// Corrige la facture d'ajustement des recettes du mois : elle avait été créée
// avec la date d'aujourd'hui, ce qui la faisait compter à tort dans les
// "Recettes du jour" en plus du "Cumul du mois". On la redate au 1er du mois.
async function corrigerDateRapport(req, res) {
  const { cle } = req.query;
  if (!cle || cle !== process.env.JWT_SECRET) {
    return res.status(403).json({ erreur: 'Clé invalide' });
  }

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(3, 0, 0, 0); // tôt le matin du 1er, pour ne jamais tomber dans "aujourd'hui"

  const resultat = await prisma.facture.updateMany({
    where: { fidele: 'Import (registre)' },
    data: { date: debutMois },
  });

  res.json({ statut: `${resultat.count} facture(s) de rapport re-datées au ${debutMois.toISOString()}` });
}

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

async function executerImportMesses() {
  etatImport = { enCours: true, termine: false, facturesCreees: 0, intentionsCreees: 0, erreurs: [], erreurGenerale: null };

  try {
    const designation = await prisma.designation.findFirst({ where: { code: 'DM' } });
    if (!designation) throw new Error('Désignation DM (Demande de Messe) introuvable');

    const cure = await prisma.utilisateur.findFirst({ where: { role: 'CURE', actif: true } });
    if (!cure) throw new Error('Aucun compte Curé actif trouvé');

    const FIDELE_IMPORT = 'Import (registre) - Messes';
    await prisma.facture.deleteMany({ where: { fidele: FIDELE_IMPORT } });

    for (const bloc of donnees) {
      if (!bloc.intentions || bloc.intentions.length === 0) continue;
      try {
        const numero = await genererNumero();
        await prisma.facture.create({
          data: {
            numero,
            fidele: FIDELE_IMPORT,
            etablitParId: cure.id,
            montantTotal: 0,
            remise: 0,
            netAPayer: 0,
            lignes: {
              create: bloc.intentions.map((it) => ({
                designationId: designation.id,
                quantite: 1,
                prixUnitaire: 0,
                montant: 0,
                demandesMesse: {
                  create: [
                    {
                      typeIntention: it.typeIntention,
                      intention: it.texte,
                      dateMesse: new Date(`${bloc.date}T12:00:00`),
                      heureDebut: bloc.heure,
                    },
                  ],
                },
              })),
            },
          },
        });
        etatImport.facturesCreees += 1;
        etatImport.intentionsCreees += bloc.intentions.length;
      } catch (erreurBloc) {
        etatImport.erreurs.push({ date: bloc.date, heure: bloc.heure, erreur: erreurBloc.message });
      }
    }
  } catch (e) {
    console.error('Erreur import messes Mariaux :', e);
    etatImport.erreurGenerale = e.message;
  } finally {
    etatImport.enCours = false;
    etatImport.termine = true;
    console.log('Import messes Mariaux terminé :', JSON.stringify(etatImport));
  }
}

async function lancerImportMesses(req, res) {
  const { cle } = req.query;
  if (!cle || cle !== process.env.JWT_SECRET) {
    return res.status(403).json({ erreur: 'Clé invalide' });
  }
  if (etatImport.enCours) {
    return res.json({ statut: 'Un import est déjà en cours, consulte /statut.' });
  }

  executerImportMesses();
  res.json({ statut: 'Import lancé en arrière-plan. Consulte /api/import-messes-mariaux/statut dans une minute.' });
}

function obtenirStatutImportMesses(req, res) {
  const { cle } = req.query;
  if (!cle || cle !== process.env.JWT_SECRET) {
    return res.status(403).json({ erreur: 'Clé invalide' });
  }
  res.json(etatImport);
}

module.exports = { corrigerDateRapport, lancerImportMesses, obtenirStatutImportMesses };
