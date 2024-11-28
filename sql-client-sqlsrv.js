const WebSocket = require('ws');
const sql = require('mssql'); // Bibliothèque pour interagir avec SQL Server

// Configuration du WebSocket
const ws = new WebSocket(`ws://212.28.180.216:8081/?token=bdc9834cd0e42e0416d8b524767c9d8ff4d90b7dd373c536aa23e4743885`);

// Configuration de la connexion à SQL Server
const sqlConfig = {
    user: 'cheikh20012',
    password: 'P@sser1234',
    server: '100.75.106.79',
    database: 'MADINA2021',
    options: {
        encrypt: false,
        enableArithAbort: true
    }
};

// Dernière valeur de cbModification traitée pour éviter de renvoyer les mêmes données
let lastProcessedModification = null;

// Fonction pour surveiller les nouvelles insertions/modifications dans F_COLLABORATEUR
async function monitorCollaboratorTable() {
    try {
        await sql.connect(sqlConfig);
        console.log('Client SQL Server connecté au serveur WebSocket et à SQL Server');

        // Requête pour détecter de nouvelles insertions ou modifications en utilisant cbModification
        setInterval(async () => {
            const query = `
                SELECT CA_No, CA_Intitule, cbModification 
                FROM F_CAISSE 
                WHERE cbModification > @lastProcessedModification
                ORDER BY cbModification ASC
            `;

            // Exécution de la requête avec la dernière valeur de cbModification traitée
            const request = new sql.Request();
            request.input('lastProcessedModification', sql.DateTime, lastProcessedModification || new Date(0)); // Initialise avec la date "0" si c'est la première exécution

            const result = await request.query(query);

            // Vérifier si de nouvelles modifications sont trouvées
            if (result.recordset.length > 0) {
                result.recordset.forEach(row => {
                    const message = JSON.stringify({
                        type: 'sync',
                        data: {
                            num_utilisateur: row.CA_No,
                            nom_vendeur: row.CA_Intitule,
                            role: 'vendeur',
                            operation: 'INSERT_OR_UPDATE'
                        }
                    });

                    // Envoyer le message au serveur WebSocket
                    ws.send(message);

                    // Mettre à jour la dernière valeur de cbModification traitée
                    lastProcessedModification = row.cbModification;
                });
            }
        }, 10000); // Vérification toutes les 10 secondes
    } catch (err) {
        console.error('Erreur de connexion à SQL Server :', err);
    }
}

// Établir la connexion au serveur WebSocket
ws.on('open', () => {
    monitorCollaboratorTable();
});

// Gérer les messages reçus du serveur WebSocket
ws.on('message', (data) => {
    const message = JSON.parse(data);

    // Vérifier si un ACK est requis
    if (message.id && message.data) {
        console.log('Message reçu du serveur :', message.data);

        // Envoyer un ACK en réponse
        const ackMessage = JSON.stringify({
            type: 'ack',
            messageId: message.id
        });
        ws.send(ackMessage);
    }
});

// Gestion de la déconnexion
ws.on('close', () => {
    console.log('Déconnecté du serveur WebSocket');
});
