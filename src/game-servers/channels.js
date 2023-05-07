const _ = require('underscore');

function isVoiceForbidden(id, channels) {
    for(let channel of channels) {
        if(id === channel.id) return true;
    }
    return false;
}

function handleForbiddenChannel(state) {
    let pictures = ['https://i.imgur.com/keawBBi.png', 'https://i.imgur.com/yzbbRjj.gif', 'https://i.imgur.com/nUB4jiW.gif', 'https://i.imgur.com/Brtw1E0.gif'];
    state.disconnect('Forbidden channel');
    state.member.send('Je peux pas te laisser faire ça Michel...').catch(console.error);
    setTimeout(() => {
        state.member
            .send('Tiens un lot de consolation')
            .catch(console.error);
        state.member
            .send({files: [_.sample(pictures)]})
            .catch(console.error);
    }, 2000);
}

module.exports = {
    isVoiceForbidden,
    handleForbiddenChannel
}