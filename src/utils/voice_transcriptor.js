const axios = require('axios');
const prism = require('prism-media');
const { Readable } = require('stream');
const { io } = require('socket.io-client');
const wavConverter = require('wav-converter');
const { MinPriorityQueue } = require('@datastructures-js/priority-queue');
const { createAudioPlayer, NoSubscriberBehavior, createAudioResource } = require('@discordjs/voice');
const { joinVoiceChannel, getVoiceConnection, AudioPlayerStatus, StreamType, VoiceConnectionStatus, EndBehaviorType} = require('@discordjs/voice');
const { HYPERION_SERVER } = require('../../config.json');

class VoiceTranscriptor {

    constructor(stateCallback) {
        let hostname = HYPERION_SERVER['hostname']
        let port = HYPERION_SERVER['port']
        this.talk_endpoint = `http://${hostname}:${port}/audio`;
        this.chat_endpoint = `http://${hostname}:${port}/chat`;
        this.state_endpoint = `http://${hostname}:${port}/state`;
        this.channels = 1;
        this.sampleRate = 16000;

        this.interrupt_stamp = 0;
        this.guildId = null;
        this.receiver = null;
        this.player = this.createAudioPlayer();
        this.sid = null;

        this.socket = io(`ws://${hostname}:${port}`);
        this.socket.on('connect', (params) => {
            this.sid = this.socket.id;
            console.log(this.sid);
        });

        this.socket.on('interrupt', (timestamp) => {
            this.interrupt_stamp = timestamp;
            this.audioQueue.clear();
            this.player.stop()
        });

        this.busy = false;
        this.audioQueue = new MinPriorityQueue((obj) => obj[1]);
        this.listenedUsers = new Set();

        this.currentState = 'available';
        this.stateChangeCallback = () => {
            stateCallback(this.currentState);
        };
    }

    // Events

    onConnectionReady() {
        console.log('Connection ready');
        const connection = getVoiceConnection(this.guildId);
        connection.subscribe(this.player);
    }

    onSpeech(userId) {
        if (this.listenedUsers.has(userId)) {
            return;
        }
        this.listenedUsers.add(userId);

        const opusDecoder = new prism.opus.Decoder({
            frameSize: 960,
            channels: this.channels,
            rate: this.sampleRate
        });

        console.log('Listening to user !');
        const speech = this.receiver.subscribe(userId, {end: {behavior: EndBehaviorType.AfterSilence, duration: 1000}});
        speech.once('end', () => {
            console.log('Speech ended.');
            this.listenedUsers.delete(userId);
        });

        const config = {
            responseType: 'stream',
            headers: {
                'SID': this.sid,
                'Content-Type': 'application/octet-stream'
            }
        };

        axios.post(this.talk_endpoint, speech.pipe(opusDecoder),  config)
        .then(response => {
            if (response.status === 200) {
                this.currentState = 'available';
                this.stateChangeCallback();
            }
            this.onSpokenResponse(response.data);
        })
        .catch(error => this.onErrorResponse(error));
    }

    onErrorResponse(err) {
        const statusCode = err.response.status;
        if (statusCode === 418) {
            this.currentState = 'sleeping';
            this.stateChangeCallback();
        } else {
            this.currentState = 'error';
            this.stateChangeCallback();
        }
    }

    onSpokenResponse(stream) {
        let buffer = Buffer.alloc(0);
        let decoded = {};
        stream.on('data', (data) => {
            buffer = Buffer.concat([buffer, data], buffer.length + data.length);
            try {
                buffer = this.frameDecode(buffer, decoded);
            } catch (err) {
                console.error(err);
                console.error(buffer);
            }
        });
        stream.on('error', (e) => {
            console.log(e);
        });
        stream.on('end', () => {

        });
        stream.on('close', () => {
            console.log('Connection closed');
        });
    }

    onAudioPlaying() {
        this.busy = true;
    }

    onAudioIdle() {
        this.busy = false;
        if (!this.audioQueue.isEmpty()) {
            const audioChunk = this.audioQueue.dequeue();
            this.play(audioChunk[0], audioChunk[1], audioChunk[2]);
        }
    }

    // Other

    checkState(availCallback, errorCallback) {
        axios.get(this.state_endpoint)
        .then(response => {
            if (this.currentState === 'error') {
                this.currentState = 'available';
            }
            this.stateChangeCallback();
            availCallback();
        })
        .catch(error => {
            this.currentState = 'error';
            this.stateChangeCallback();
            errorCallback();
        });
    }

    sendChat(user, message) {
        let payload = new FormData();
        payload.append('user', user);
        payload.append('message', message);
        const config = {
            responseType: 'stream',
            headers: {
                'SID': this.sid
            }
        };
        axios.post(this.chat_endpoint, payload, config)
        .then(response => this.onSpokenResponse(response.data))
        .catch(error => this.onErrorResponse(error));
    }

    joinVoiceChannel(channel) {
        this.guildId = channel.guild.id;
        const prevConnection = getVoiceConnection(this.guildId);
        if (prevConnection !== undefined) {
            if (prevConnection.state.status !== 'disconnected') {
                return; // Already connected.
            } else if (prevConnection.state.status === 'disconnected') {
                this.leaveVoiceChannel();
            }
        }

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        connection.on(VoiceConnectionStatus.Ready, () => this.onConnectionReady());
        this.receiver = connection.receiver;
        this.receiver.speaking.on('start', (userId) => this.onSpeech(userId));
        // this.receiver.speaking.on('end', (userId) => console.log(`${userId} speech ended.`));
    }

    leaveVoiceChannel() {
        const connection = getVoiceConnection(this.guildId);
        if (connection !== undefined) {
            connection.destroy();
        }
    }

    play(time, idx, buffer) {
        try {
            if (this.busy) {
                this.audioQueue.enqueue([time, idx, buffer]);
            } else if (time > this.interrupt_stamp) {
                const resource = this.createAudioResource(buffer);
                this.player.play(resource);
            } else if (!this.audioQueue.isEmpty()) {
                const audioChunk = this.audioQueue.dequeue();
                this.play(audioChunk[0], audioChunk[1], audioChunk[2]);
            }
        } catch (e) {
            console.error('Error during audio resource creation.');
            console.error(e);
        }
    }

    createAudioPlayer() {
        const audioPlayer = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause
            }
        });
        audioPlayer.on(AudioPlayerStatus.Idle, () => this.onAudioIdle());
        audioPlayer.on(AudioPlayerStatus.Playing, () => this.onAudioPlaying());
        audioPlayer.on(AudioPlayerStatus.Buffering, () => console.log('Buffering'));
        audioPlayer.on(AudioPlayerStatus.AutoPaused, () => console.log('AutoPaused'));

        return audioPlayer;
    }


    createAudioResource(audioPath) {
        const resource = createAudioResource(audioPath, {inputType: StreamType.Arbitrary});
        return resource;
    }

    frameDecode(buffer, decodedData) {
        while (buffer.length > 0) {
            try {
                let chunkHeader = new TextDecoder().decode(buffer.subarray(0, 3));
                if (['TIM', 'SPK', 'REQ', 'ANS', 'PCM'].indexOf(chunkHeader) === -1) {
                    break;
                }

                if (chunkHeader === 'TIM') {
                    decodedData['TIM'] = buffer.subarray(3, 11).readDoubleLE();
                    buffer = buffer.subarray(11);
                } else {
                    let chunkSize = buffer.readInt32BE(3);
                    let chunkContent = buffer.subarray(7, 7 + chunkSize);

                    if (chunkContent.length < chunkSize) {
                        break;
                    } else {
                        buffer = buffer.subarray(7 + chunkSize);
                    }

                    if (chunkHeader === 'REQ' || chunkHeader === 'SPK') {
                        chunkContent = new TextDecoder().decode(chunkContent);
                        decodedData[chunkHeader] = chunkContent;
                    } else if(chunkHeader === 'ANS') {
                        decodedData['IDX'] = chunkContent.readInt8(0);
                        chunkContent = new TextDecoder().decode(chunkContent.subarray(1));
                        decodedData[chunkHeader] = chunkContent;
                    } else if (chunkHeader === 'PCM') {
                        decodedData['PCM'] = chunkContent;
                        this.handleDecoded(decodedData);
                        decodedData = {};
                    }
                }
            } catch (e) {
                break;
            }
        }
        return buffer;
    }

    handleDecoded(data) {
        const time = data['TIM'];
        const idx = data['IDX'];
        const req = data['REQ'];
        const ans = data['ANS'];
        const pcm = data['PCM'];
        console.log(`\x1b[33m ${req} \x1b[0m`);
        console.log(`\x1b[36m ${ans} \x1b[0m`);

        const wavData = wavConverter.encodeWav(pcm, {
            byteRate: 16,
            numChannels: 1,
            sampleRate: 24000
        });
        this.play(time, idx, Readable.from(wavData));
    }
}


module.exports = VoiceTranscriptor;