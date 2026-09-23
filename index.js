const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error = new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Verbindung getrennt, verbinde neu...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Bot erfolgreich mit WhatsApp verbunden!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const messageContent = m.message.conversation || m.message.extendedTextMessage?.text;
        const remoteJid = m.key.remoteJid;

        // Prüfen ob es eine Gruppe ist und ob '@GPT' vorkommt
        if (remoteJid.endsWith('@g.us') && messageContent && messageContent.includes('@GPT')) {
            const prompt = messageContent.replace('@GPT', '').trim();
            console.log(`Anfrage erhalten: ${prompt}`);

            // Hier binden wir später die KI ein - im Moment antwortet er als Test
            const aiAnswer = `Hallo! Du hast gefragt: "${prompt}". Die KI-Antwort folgt gleich!`;

            await sock.sendMessage(remoteJid, { text: aiAnswer }, { quoted: m });
        }
    });
}

connectToWhatsApp();
