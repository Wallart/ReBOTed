const { SlashCommandBuilder } = require('discord.js');

module.exports = function(discord) {
	let module = {};

	module.data = new SlashCommandBuilder()
		.setName('incarne')
		.setDescription('Défini une nouvelle personalité pour ReBOTed.')
		.addStringOption(option =>
				option.setName('contexte')
					.setDescription('Les lignes de dialogues doivent commencer par <Humain>: ou ReBOTed: et finir par \\n')
					.setRequired(true));

	module.execute = async function (interaction) {
		let context = interaction.options.data[0]['value'].split('\n');
		await discord.openai.setContext(interaction.user.username, context);
		interaction.reply(`Contexte enregistré: ${context}`).catch(console.error);
	}

	return module;
};