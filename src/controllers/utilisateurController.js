const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// Réservé au Curé
async function listerUtilisateurs(req, res) {
  const utilisateurs = await prisma.utilisateur.findMany({
    select: { id: true, nom: true, identifiant: true, role: true, actif: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(utilisateurs);
}

// Réservé au Curé
async function creerUtilisateur(req, res) {
  const { nom, identifiant, pin, role } = req.body;
  if (!nom?.trim() || !identifiant?.trim() || !pin || !role) {
    return res.status(400).json({ erreur: 'Nom, identifiant, PIN et rôle sont requis' });
  }
  if (!['CURE', 'CAISSE'].includes(role)) {
    return res.status(400).json({ erreur: 'Rôle invalide' });
  }
  if (pin.length < 4) {
    return res.status(400).json({ erreur: 'Le PIN doit faire au moins 4 chiffres' });
  }

  try {
    const pinHash = await bcrypt.hash(pin, 10);
    const utilisateur = await prisma.utilisateur.create({
      data: { nom: nom.trim(), identifiant: identifiant.trim(), pinHash, role },
      select: { id: true, nom: true, identifiant: true, role: true, actif: true },
    });
    res.status(201).json(utilisateur);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ erreur: `L'identifiant "${identifiant}" existe déjà` });
    throw e;
  }
}

// Réservé au Curé — modifier nom/rôle/actif (jamais le PIN ici, voir reinitialiserPin)
async function modifierUtilisateur(req, res) {
  const { id } = req.params;
  const { nom, role, actif } = req.body;

  if (role && !['CURE', 'CAISSE'].includes(role)) {
    return res.status(400).json({ erreur: 'Rôle invalide' });
  }

  // Empêche de se désactiver soi-même ou de perdre le dernier compte Curé actif
  if (actif === false) {
    const cible = await prisma.utilisateur.findUnique({ where: { id } });
    if (cible?.id === req.utilisateur.id) {
      return res.status(400).json({ erreur: 'Impossible de désactiver ton propre compte' });
    }
    if (cible?.role === 'CURE') {
      const nbCuresActifs = await prisma.utilisateur.count({ where: { role: 'CURE', actif: true } });
      if (nbCuresActifs <= 1) {
        return res.status(400).json({ erreur: 'Impossible de désactiver le dernier compte Curé actif' });
      }
    }
  }

  const utilisateur = await prisma.utilisateur.update({
    where: { id },
    data: { ...(nom ? { nom: nom.trim() } : {}), ...(role ? { role } : {}), ...(actif !== undefined ? { actif } : {}) },
    select: { id: true, nom: true, identifiant: true, role: true, actif: true },
  });
  res.json(utilisateur);
}

// Réservé au Curé — réinitialise le PIN d'un compte (le sien ou celui d'un autre)
async function reinitialiserPin(req, res) {
  const { id } = req.params;
  const { nouveauPin } = req.body;
  if (!nouveauPin || nouveauPin.length < 4) {
    return res.status(400).json({ erreur: 'Le nouveau PIN doit faire au moins 4 chiffres' });
  }

  const pinHash = await bcrypt.hash(nouveauPin, 10);
  await prisma.utilisateur.update({ where: { id }, data: { pinHash } });
  res.json({ statut: 'ok' });
}

// Accessible à tout utilisateur connecté — changer soi-même son PIN
async function changerMonPin(req, res) {
  const { ancienPin, nouveauPin } = req.body;
  if (!ancienPin || !nouveauPin) {
    return res.status(400).json({ erreur: 'Ancien et nouveau PIN requis' });
  }
  if (nouveauPin.length < 4) {
    return res.status(400).json({ erreur: 'Le nouveau PIN doit faire au moins 4 chiffres' });
  }

  const utilisateur = await prisma.utilisateur.findUnique({ where: { id: req.utilisateur.id } });
  const valide = await bcrypt.compare(ancienPin, utilisateur.pinHash);
  if (!valide) return res.status(401).json({ erreur: 'Ancien PIN incorrect' });

  const pinHash = await bcrypt.hash(nouveauPin, 10);
  await prisma.utilisateur.update({ where: { id: req.utilisateur.id }, data: { pinHash } });
  res.json({ statut: 'ok' });
}

module.exports = { listerUtilisateurs, creerUtilisateur, modifierUtilisateur, reinitialiserPin, changerMonPin };
