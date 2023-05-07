const { SlashCommandBuilder } = require('discord.js');

module.exports = function(discord) {
	let module = {};

	module.data = new SlashCommandBuilder()
		.setName('tue')
		.setDescription('Efface la personnalité de ReBOTed.');

	module.execute = async function (interaction) {
		await discord.openai.clearContext(interaction.user.username);
		interaction.reply('Personnalité effacée.').catch(console.error);
	}

	return module;
};