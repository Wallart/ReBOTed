const { queryGameServerInfo } = require('steam-server-query');
const { GAME_CHANNELS, SERVER_HOST, RENAME_INTERVAL} = require('../../config.json');

module.exports = function(discord) {

    function fetchServer(gameQueryPort) {
        return queryGameServerInfo(`${SERVER_HOST}:${gameQueryPort}`);
    }

    function monitor() {
        console.debug(`Refresh channel initiated.`);

        let newNames = [];
        for(let channel of GAME_CHANNELS) {
            if(channel.game === 'satisfactory') {
                // TMP WORKAROUND
                continue;
            }

            newNames.push(fetchServer(channel.queryPort).then((state) => {
                // console.log(state.name);
                return `${channel.name}: ${state.players}/${state.maxPlayers}`;
            }));
        }

       Promise.all(newNames)
            .then((values) => {
                console.debug(`${values.length} server(s) fetched.`)
                return values.map((v, i) => discord.renameChannel(GAME_CHANNELS[i].id, v));
            })
            .then((res) => {
                console.debug(`Rename requests sent.`);
                return Promise.all(res);
            })
            .then((res) => {
                console.debug(res);
                setTimeout(monitor, RENAME_INTERVAL * 60 * 1000);
            })
           .catch((e) => {
               console.error(e);
               setTimeout(monitor, RENAME_INTERVAL * 60 * 1000);
           })
    }

    return {
        monitor: monitor
    }
};