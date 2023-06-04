const fs = require('node:fs');
const path = require('node:path');
const openai = require('../openai/openai');
const VoiceTranscriptor = require('./voice_transcriptor');
const { Client, GatewayIntentBits, Collection, Partials, ActivityType } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const { BLA_BLA_CHANNEL } = require('../../config.json');

class Discord {

    constructor() {
        this.openai = openai;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ],
            partials: [Partials.Channel]
        });

        this.client.commands = new Collection();
        const commandsPath = path.join(path.dirname(__dirname), 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath)(this);
            // Set a new item in the Collection
            // With the key as the command name and the value as the exported module
            this.client.commands.set(command.data.name, command);
        }
        this.voice = new VoiceTranscriptor((state) => this.stateChanged(state), (img) => this.sendImage(img));
    }

    sendImage(img) {
        const payload = { files: [{ attachment: img, name: `${uuidv4()}.jpg` }] };
        this.getChannelById(BLA_BLA_CHANNEL).send(payload);
    }

    stateChanged(state) {
        // invisible
        let status = 'online';
        let activityName = 'vos malheurs 😤';
        let activityType = ActivityType.Listening;
        if (state === 'sleeping') {
            status = 'idle';
            activityName = 'sleeping simulator 💤';
            activityType = ActivityType.Playing;
        } else if (state === 'error') {
            status = 'dnd';
            activityName = 'ses problèmes existentiels 🤯';
            activityType = ActivityType.Watching;
        }

        this.client.user
            .setPresence({
                activities: [{ name: activityName, type: activityType }],
                status: status
            });
    }

    on(event, func) {
        this.client.on(event, func);
    }

    once(event, func) {
        this.client.once(event, func);
    }

    login(token) {
        return this.client.login(token);
    }

    getChannelById(id) {
        return this.client.channels.cache.get(id);
    }

    getChannelByName(name) {
        return this.client.channels.cache.find(channel => channel.name === name);
    }

    getMemberById(id) {
        return this.client.users.cache.get(id);
    }

    getMessageById(channel_id, id) {
        let channel = this.getChannelById(channel_id);
        return channel.messages.fetch(id);
    }

    getCommands(name) {
        return this.client.commands.get(name);
    }

    renameChannel(channelId, name) {
        // let self = this;
        return new Promise((resolve, reject) => {
            let channelObj = this.getChannelById(channelId);
            if(channelObj.name !== name) {
                channelObj.setName(name).then(() => resolve(`Updated to ${name}`)).catch((e) => reject(e));
            } else{
                resolve(`Unchanged ${name}`);
            }
        });
    }
}

module.exports = new Discord();