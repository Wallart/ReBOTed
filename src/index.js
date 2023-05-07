#!/usr/bin/env node

const discord = require('./utils/discord');
const { monitor } = require('./game-servers/monitor')(discord);
const { createButtonsGrid } = require('./mid-journey/ui');
const { isVoiceForbidden, handleForbiddenChannel } = require('./game-servers/channels');
const { TOKEN_DISCORD, USERID_MIDJOURNEY, USERID_REBOTED, MIDJOURNEY_CHANNELS_ID, GAME_CHANNELS, BOT_VOICE_CHANNEL } = require('../config.json');
const { handleClickRequest } = require('./mid-journey/requests');

(() => {

    discord.on('voiceStateUpdate', (oldState, newState) => {
        // check for bot
        if (oldState.member.user.bot) return;

        if (isVoiceForbidden(newState.channelId, GAME_CHANNELS)) {
            handleForbiddenChannel(newState);
        }
    });

    discord.on('messageCreate',  (message) => {
        if (MIDJOURNEY_CHANNELS_ID.indexOf(message.channelId) > -1) {
            let userid = message.author.id;
            if (userid === USERID_MIDJOURNEY) {
                if (message.components.length > 0) {
                    createButtonsGrid(message)
                }
            } else if (userid !== USERID_REBOTED) {
                message.delete().then(console.log).catch(console.error);
            }
        } else if (message.channel.type === 1 || message.content.indexOf(`<@${USERID_REBOTED}>`) > -1) {
            let userid = message.author.id;
            if (userid !== USERID_REBOTED) {
                let question = message.content.split(`<@${USERID_REBOTED}>`).join('').trim();
                let channel = discord.getChannelById(message.channelId);
                discord.openai.answer(message.author.username, question).then((answer) => {
                    // message.reply(answer);
                    if (answer.length > 0) {
                        channel.send(answer);
                    }
                }).catch(console.error);
            }
        }
    });

    discord.on('interactionCreate', async interaction => {
	    if (interaction.isButton()) {
            if (MIDJOURNEY_CHANNELS_ID.indexOf(interaction.channelId) > -1) {
                handleClickRequest(discord, interaction);
            }
        } else if (interaction.isChatInputCommand()) {
            const command = discord.getCommands(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    });

    discord.once('ready', () => {
        console.log('ReBOTed connected');

        setInterval(() => {
            discord.voice.checkState(() => {
                discord.voice.joinVoiceChannel(discord.getChannelById(BOT_VOICE_CHANNEL));
            }, () => {
                console.error('Unable to reach hyperion backend.');
                discord.voice.leaveVoiceChannel();
            });
        }, 5000);
    });

    discord.login(TOKEN_DISCORD).catch(console.error);

})();