// Exécution : node src/scripts/seed.js
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

async function main() {
  const pinCureHash = await bcrypt.hash('1234', 10);
  const pinCaisseHash = await bcrypt.hash('1234', 10);

  await prisma.utilisateur.upsert({
    where: { identifiant: 'cure' },
    update: {},
    create: { nom: 'Curé', identifiant: 'cure', pinHash: pinCureHash, role: 'CURE' },
  });

  await prisma.utilisateur.upsert({
    where: { identifiant: 'caisse' },
    update: {},
    create: { nom: 'Caisse', identifiant: 'caisse', pinHash: pinCaisseHash, role: 'CAISSE' },
  });

  const rubriqueMesses = await prisma.rubrique.upsert({
    where: { libelle: 'Messes' },
    update: {},
    create: { libelle: 'Messes' },
  });

  const rubriqueDenier = await prisma.rubrique.upsert({
    where: { libelle: 'Denier de culte' },
    update: {},
    create: { libelle: 'Denier de culte' },
  });

  await prisma.designation.upsert({
    where: { code: 'MD' },
    update: {},
    create: {
      code: 'MD',
      libelle: 'DEMANDE DE MESSE',
      type: 'B',
      prixUnitaire: 2000,
      rubriqueId: rubriqueMesses.id,
    },
  });

  await prisma.designation.upsert({
    where: { code: 'AUT4' },
    update: {},
    create: {
      code: 'AUT4',
      libelle: 'DENIER DE CULTE FEMME',
      type: 'A',
      prixUnitaire: 43000,
      rubriqueId: rubriqueDenier.id,
    },
  });

  await prisma.designation.upsert({
    where: { code: 'AUT5' },
    update: {},
    create: {
      code: 'AUT5',
      libelle: 'DENIER DE CULTE HOMME',
      type: 'A',
      prixUnitaire: 43000,
      rubriqueId: rubriqueDenier.id,
    },
  });

  console.log('Seed terminé : comptes cure/1234 et caisse/1234 créés.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
