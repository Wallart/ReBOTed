const { SlashCommandBuilder } = require('discord.js');

module.exports = function() {
	let module = {};

	module.data = new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Répond avec un pong.');

	module.execute = async function(interaction) {
		await interaction.reply({ content: 'pong', ephemeral: true })
	};

	return module;
};