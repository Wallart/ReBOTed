const { SlashCommandBuilder } = require('discord.js');
const { handleImageRequest } = require('../mid-journey/requests');

module.exports = function(discord) {
	let module = {};

	module.data = new SlashCommandBuilder()
		.setName('dessine')
		.setDescription('Créé une requête /image à destination de Midjourney Bot')
		.addStringOption(option =>
			option.setName('prompt')
				.setDescription('Description détaillée de l\'image à produire.')
				.setRequired(true));

	module.execute = async function (interaction) {
		await handleImageRequest(discord, interaction);
	}

	return module;
};