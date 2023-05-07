#!/usr/bin/env python3
from flask import Flask, request
from discum.utils.button import Buttoner
from discum.utils.slash import SlashCommander

import os
import json
import discum

app = Flask(__name__)


@app.route('/imagine', methods=['POST'])
def imagine():
    payload = request.get_json(force=True)
    keywords = payload['keywords']
    channel_id = payload['channelId']

    bot_user = discum.Client(token=TOKEN_WALLART, log=True)
    slash_cmd = SlashCommander(bot_user.getSlashCommands(str(USERID_MIDJOURNEY)).json())
    req = slash_cmd.get(['imagine'], inputs={'prompt': keywords})
    bot_user.triggerSlashCommand(applicationID=str(USERID_MIDJOURNEY), channelID=channel_id, guildID=str(GUILD_ID), data=req)

    bot_user.gateway.close()
    return 'Request forwarded to MidJourney Bot with success.'


@app.route('/click', methods=['POST'])
def click():
    payload = request.get_json(force=True)
    message = payload['message']
    channel_id = payload['channelId']
    req_button = payload['clickedButton']
    buts = Buttoner(message['components'])
    button = ...
    if req_button == 'retry':
        button = dict(component_type=buts.components[0]['components'][-1]['type'], custom_id=buts.components[0]['components'][-1]['custom_id'])
    else:
        button = buts.getButton(req_button)

    bot_user = discum.Client(token=TOKEN_WALLART, log=True)
    bot_user.click(
        int(message['authorId']),
        channelID=channel_id,
        guildID=GUILD_ID,
        messageID=int(message['id']),
        messageFlags=message['flags'],
        data=button,
    )

    bot_user.gateway.close()
    return 'Request forwarded to MidJourney Bot with success.'


if __name__ == '__main__':
    dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
    with open(os.path.join(dir, 'config.json'), 'r') as f:
        conf = json.load(f)

    TOKEN_WALLART = conf['TOKEN_WALLART']
    GUILD_ID = int(conf['GUILDID_REPORTED'])
    USERID_WALLART = int(conf['USERID_WALLART'])
    USERID_MIDJOURNEY = int(conf['USERID_MIDJOURNEY'])

    app.run(host=conf['MIDJOURNEY_FLASK']['hostname'], port=conf['MIDJOURNEY_FLASK']['port'])
