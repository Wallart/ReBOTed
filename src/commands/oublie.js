const { SlashCommandBuilder } = require('discord.js');
const {USERID_MIDJOURNEY} = require("../../config.json");

module.exports = function(discord) {
	let module = {};

	module.data = new SlashCommandBuilder()
		.setName('oublie')
		.setDescription('Efface la mémoire immédiate de ReBOTed.');

	module.execute = async function (interaction) {
		await discord.openai.clearMemory(interaction.user.username);
		interaction.reply('Mémoire effacée.').catch(console.error);
	}

	return module;
};