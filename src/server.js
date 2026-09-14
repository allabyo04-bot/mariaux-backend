require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const designationRoutes = require('./routes/designationRoutes');
const factureRoutes = require('./routes/factureRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const messeRoutes = require('./routes/messeRoutes');
const horaireRoutes = require('./routes/horaireRoutes');
const fideleRoutes = require('./routes/fideleRoutes');
const utilisateurRoutes = require('./routes/utilisateurRoutes');
const fermetureRoutes = require('./routes/fermetureRoutes');
const { lancerImportMesses, obtenirStatutImportMesses, ajouterRecapJour } = require('./controllers/syncJourController'); // TEMPORAIRE - à retirer après usage

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ statut: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/designations', designationRoutes);
app.use('/api/factures', factureRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/messes', messeRoutes);
app.use('/api/horaires', horaireRoutes);
app.use('/api/fideles', fideleRoutes);
app.use('/api/utilisateurs', utilisateurRoutes);
app.use('/api/fermetures', fermetureRoutes);
app.get('/api/sync-messes', lancerImportMesses); // TEMPORAIRE - à retirer après usage
app.get('/api/sync-messes/statut', obtenirStatutImportMesses); // TEMPORAIRE - à retirer après usage
app.get('/api/sync-recap-jour', ajouterRecapJour); // TEMPORAIRE - à retirer après usage

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`LOGESPAC backend démarré sur le port ${PORT}`));
