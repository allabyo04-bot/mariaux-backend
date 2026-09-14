// Exécuté chaque jour par un service Cron Job Railway séparé.
// Exporte les tables clés en JSON et l'envoie par email via Resend.
const { Resend } = require('resend');
const prisma = require('../lib/prisma');

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY absente des variables d\'environnement.');
    process.exit(1);
  }

  const [utilisateurs, designations, rubriques, horaires, fideles, factures] = await Promise.all([
    prisma.utilisateur.findMany({ select: { id: true, nom: true, identifiant: true, role: true, actif: true, createdAt: true } }), // sans pinHash
    prisma.designation.findMany(),
    prisma.rubrique.findMany(),
    prisma.horaireMesse.findMany(),
    prisma.fidele.findMany(),
    prisma.facture.findMany({
      include: { lignes: { include: { designation: true, demandesMesse: true } } },
    }),
  ]);

  const sauvegarde = {
    dateExport: new Date().toISOString(),
    utilisateurs,
    designations,
    rubriques,
    horaires,
    fideles,
    factures,
  };

  const contenu = JSON.stringify(sauvegarde, null, 2);
  const nomFichier = `logespac_sauvegarde_${new Date().toISOString().slice(0, 10)}.json`;

  const { data, error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'allabyo04@gmail.com',
    subject: `LOGESPAC — Sauvegarde du ${new Date().toLocaleDateString('fr-FR')}`,
    text: `Sauvegarde automatique LOGESPAC.\n\nFactures : ${factures.length}\nFidèles : ${fideles.length}\nDésignations : ${designations.length}\nUtilisateurs : ${utilisateurs.length}`,
    attachments: [
      {
        filename: nomFichier,
        content: Buffer.from(contenu).toString('base64'),
      },
    ],
  });

  if (error) {
    console.error('Erreur Resend :', JSON.stringify(error));
    process.exit(1);
  }

  console.log(`Sauvegarde envoyée : ${nomFichier} (id Resend: ${data?.id})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Erreur sauvegarde LOGESPAC :', e);
    try {
      await prisma.$disconnect();
    } catch (_) {
      // ignoré : on veut arrêter le processus quoi qu'il arrive
    }
    process.exit(1);
  });
