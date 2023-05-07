const http = require('http');
const { USERID_MIDJOURNEY, USERID_WALLART, MIDJOURNEY_FLASK, MIDJOURNEY_CHANNELS_ID } = require('../../config.json');

function handleImageRequest(discord, interaction) {
    if (MIDJOURNEY_CHANNELS_ID.indexOf(interaction.channelId) === -1) {
        let content = 'Commande interdite en dehors des salons';
        for(let id of MIDJOURNEY_CHANNELS_ID) {
            content += ` <#${id}>`;
        }

        interaction.reply({ content: content, ephemeral: true })
        return;
    }

    let userid = interaction.user.id
    let keywords = interaction.options.data[0]['value'];
    interaction.reply(`<@${userid}> demande "${keywords}" à <@${USERID_MIDJOURNEY}>`).catch(console.error);

    let channel = discord.getChannelById(interaction.channelId);
    let opts = MIDJOURNEY_FLASK;
    opts['path'] = '/imagine';
    opts['method'] = 'POST';
    const req = http.request(opts, res => {
        console.log(`HTTP ${res.statusCode} for /image ${keywords}`);
        if (res.statusCode !== 200) {
            channel.send(`<@${USERID_WALLART}> a refusé la requête. Salaud de merde !`);
        }
    });
    req.on('error', err => {
        console.error(err);
        channel.send(`<@${USERID_WALLART}> ne répond plus. Putain de merde !`).catch(console.error);
    });
    req.write(JSON.stringify({keywords: keywords, channelId: interaction.channelId}));
    req.end();
}

function handleClickRequest(discord, interaction) {
    let words = ['laver ses slips', 'faire sa vaisselle', 'lui raser les couilles', 'tondre sa pelouse']
    let word = words[Math.floor(Math.random() * words.length)];
    let msg = `Ok Michel, je fais suivre ta requête à <@${USERID_MIDJOURNEY}>. Non mais quel branleur ! Bientôt il va me demander de ${word}...`
    interaction.reply({ content: msg, ephemeral: true }).catch(console.error);

    let button_id = interaction.customId;
    let message_content = interaction.message.content;
    let id_message = message_content.split('Job ID: ')[1]

    discord.getMessageById(interaction.channelId, id_message).then(msg => {
        let opts = MIDJOURNEY_FLASK;
        opts['path'] = '/click';
        opts['method'] = 'POST';
        const req = http.request(opts, res => {
            console.log(`HTTP ${res.statusCode} for /click`);
            if (res.statusCode !== 200) {
                let channelObj = discord.getChannelById(interaction.channelId);
                channelObj.send(`<@${USERID_WALLART}> a refusé la requête. Enfoiré de merde !`);
            }
        });
        req.on('error', console.error);
        req.write(JSON.stringify({message: msg, clickedButton: button_id, channelId: interaction.channelId}));
        req.end();

    }).catch(console.error);
}

module.exports = {
    handleImageRequest,
    handleClickRequest
};