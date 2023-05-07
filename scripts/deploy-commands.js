#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const { USERID_REBOTED, GUILDID_REPORTED, TOKEN_DISCORD } = require('../config.json');

const commands = [];
const commandsPath = path.join(path.dirname(__dirname), 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath)(null);
	commands.push(command.data.toJSON());
}

const rest = new REST({version: '10' }).setToken(TOKEN_DISCORD);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationGuildCommands(USERID_REBOTED, GUILDID_REPORTED),
			{ body: commands },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})();