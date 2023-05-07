const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createTilesButtons() {
    const row1 = new ActionRowBuilder()
        .addComponents(
            createButton('U1', 'U1'),
            createButton('U2', 'U2'),
            createButton('U3', 'U3'),
            createButton('U4', 'U4'),
            createButton('retry', '🔄')
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            createButton('V1', 'V1'),
            createButton('V2', 'V2'),
            createButton('V3', 'V3'),
            createButton('V4', 'V4')
        );

    return [row1, row2]
}

function createButtonsGrid(message) {
    let comps = createTilesButtons();
    if (message.type === 0) {
        message
            .reply({content: `${message.content} - Job ID: ${message.id}`, files: [Array.from(message.attachments.values())[0].attachment], components: comps})
            .catch(console.error);

    } else if (message.type === 19) {
        if (message.components[0].components[0].data.label !== 'U1') {
            comps = new ActionRowBuilder()
                .addComponents(
                    createButton('Make Variations', 'Générer variations'),
                    createButton('Upscale to Max', 'Upscaling Max'),
                    createButton('Light Upscale Redo', 'Upscaling Léger')
                );
            comps = [comps]
        }
        message
            .reply({content: `${message.content} - Job ID: ${message.id}`, files: [Array.from(message.attachments.values())[0].attachment], components: comps})
            .catch(console.error);
    }
}

function createButton(id, label) {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary)
}

module.exports = {
    createButtonsGrid
}