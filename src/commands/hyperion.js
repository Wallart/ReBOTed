const axios = require('axios');
const { SlashCommandBuilder } = require('discord.js');

module.exports = function(discord) {
	let module = {};

	module.data = new SlashCommandBuilder()
		.setName('hyperion')
		.setDescription('Envoie un message textuel à Hypérion, qui répondra en vocal.')
		.addStringOption(option =>
			option.setName('message')
				.setDescription('Message à envoyer.')
				.setRequired(true));

	module.execute = async function (interaction) {
		let user = interaction.user.username;
		let message = interaction.options.data[0]['value'];
		interaction.reply(message);
		discord.voice.sendChat(user, message);
	}

	return module;
};