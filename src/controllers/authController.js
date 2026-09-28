const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { JWT_SECRET } = require('../middleware/auth');

// Protection contre les devinettes de PIN : après 5 mots de passe erronés de
// suite sur un même identifiant, le compte est bloqué 15 minutes. Le compteur
// repart à zéro à la première connexion réussie.
const MAX_ECHECS = 5;
const DUREE_BLOCAGE_MINUTES = 15;
const CONSERVATION_JOURNAL_JOURS = 180;

function adresseIp(req) {
  const xff = req.headers['x-forwarded-for'];
  const premiere = typeof xff === 'string' ? xff.split(',')[0].trim() : '';
  return premiere || req.socket?.remoteAddress || null;
}

// Trace de chaque tentative (jamais le PIN saisi). Une panne du journal ne doit
// jamais empêcher quelqu'un de se connecter.
async function journaliser(identifiant, resultat, req) {
  try {
    await prisma.tentativeConnexion.create({
      data: { identifiant: String(identifiant).slice(0, 100), resultat, ip: adresseIp(req) },
    });
  } catch (e) {
    console.error('Journal de connexion :', e.message);
  }
}

async function connexion(req, res) {
  const { identifiant, pin } = req.body;
  if (!identifiant || !pin) {
    return res.status(400).json({ erreur: 'Identifiant et PIN requis' });
  }
  if (typeof identifiant !== 'string' || typeof pin !== 'string') {
    return res.status(400).json({ erreur: 'Identifiants incorrects' });
  }

  const utilisateur = await prisma.utilisateur.findUnique({ where: { identifiant } });
  if (!utilisateur) {
    await journaliser(identifiant, 'INCONNU', req);
    return res.status(401).json({ erreur: 'Identifiants incorrects' });
  }

  const maintenant = new Date();
  if (utilisateur.bloqueJusqua && utilisateur.bloqueJusqua > maintenant) {
    const minutes = Math.max(1, Math.ceil((utilisateur.bloqueJusqua - maintenant) / 60000));
    await journaliser(identifiant, 'BLOQUE', req);
    return res.status(429).json({
      erreur: `Trop d'essais. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
    });
  }

  if (!utilisateur.actif) {
    await journaliser(identifiant, 'DESACTIVE', req);
    return res.status(401).json({ erreur: 'Identifiants incorrects' });
  }

  const pinValide = await bcrypt.compare(pin, utilisateur.pinHash);
  if (!pinValide) {
    await journaliser(identifiant, 'ECHEC', req);
    const apres = await prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: { echecsConsecutifs: { increment: 1 } },
    });
    if (apres.echecsConsecutifs >= MAX_ECHECS) {
      await prisma.utilisateur.update({
        where: { id: utilisateur.id },
        data: {
          echecsConsecutifs: 0,
          bloqueJusqua: new Date(Date.now() + DUREE_BLOCAGE_MINUTES * 60000),
        },
      });
      return res.status(429).json({
        erreur: `Trop d'essais. Compte bloqué ${DUREE_BLOCAGE_MINUTES} minutes.`,
      });
    }
    return res.status(401).json({ erreur: 'Identifiants incorrects' });
  }

  if (utilisateur.echecsConsecutifs > 0 || utilisateur.bloqueJusqua) {
    await prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: { echecsConsecutifs: 0, bloqueJusqua: null },
    });
  }
  await journaliser(identifiant, 'SUCCES', req);

  // Ménage discret : on ne garde que les 6 derniers mois de journal.
  prisma.tentativeConnexion
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - CONSERVATION_JOURNAL_JOURS * 86400000) } } })
    .catch(() => {});

  const token = jwt.sign(
    { id: utilisateur.id, nom: utilisateur.nom, role: utilisateur.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    utilisateur: { id: utilisateur.id, nom: utilisateur.nom, role: utilisateur.role },
  });
}

// Réservé au Curé : les 300 dernières tentatives de connexion.
async function journalConnexions(req, res) {
  const lignes = await prisma.tentativeConnexion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json(lignes);
}

module.exports = { connexion, journalConnexions };
