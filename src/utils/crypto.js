const fs = require('fs');
const crypto = require('crypto');

function encrypt(publicKeyPath, data) {
    let publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    const buffer = Buffer.from(data, 'utf8');
    const encrypted = crypto.publicEncrypt({
        key: publicKey,
        oaepHash: 'sha-256',
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    }, buffer);

    return encrypted.toString('base64');
}

module.exports = {
    encrypt
};