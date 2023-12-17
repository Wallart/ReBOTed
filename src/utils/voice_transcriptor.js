const axios = require('axios');
const { Agent } = require('https');
const { Readable } = require('stream');
const { readFileSync} = require('fs');
const prism = require('prism-media');
const { io } = require('socket.io-client');
const wavConverter = require('wav-converter');
const { MinPriorityQueue } = require('@datastructures-js/priority-queue');
const { HYPERION_SERVER, HYPERION_CLIENT_VERSION } = require('../../config.json');
const { createAudioPlayer, NoSubscriberBehavior, createAudioResource } = require('@discordjs/voice');
const { joinVoiceChannel, getVoiceConnection, AudioPlayerStatus, StreamType, VoiceConnectionStatus, EndBehaviorType} = require('@discordjs/voice');

class VoiceTranscriptor {

    constructor(stateCallback, imgCallback) {
        let hostname = HYPERION_SERVER['hostname']
        let port = HYPERION_SERVER['port']
        this.talk_endpoint = `https://${hostname}:${port}/audio`;
        this.chat_endpoint = `https://${hostname}:${port}/chat`;
        this.state_endpoint = `https://${hostname}:${port}/state`;

        // axios.defaults.httpsAgent = new Agent({
        //   ca: readFileSync('cert.pem'),
        //   cert: readFileSync('cert.pem'),
        // });
        // TODO Would be better to do a strict cert check.
        const httpsOptions = { rejectUnauthorized: false };
        axios.defaults.httpsAgent = new Agent(httpsOptions);
        this.channels = 1;
        this.sampleRate = 16000;

        this.interrupt_stamp = 0;
        this.guildId = null;
        this.receiver = null;
        this.player = this.createAudioPlayer();
        this.sid = null;

        this.socket = io(`wss://${hostname}:${port}`, httpsOptions);
        this.socket.on('connect', (params) => {
            this.sid = this.socket.id;
            console.log(this.sid);
        });

        this.socket.on('error', console.error);
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
        this.imgCallback = (img) => {
            imgCallback(img);
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
                'version': HYPERION_CLIENT_VERSION,
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
        stream.on('data', (data) => {
            buffer = Buffer.concat([buffer, data], buffer.length + data.length);
            buffer = this.frameDecode(buffer);
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
        const config = { headers: {'version': HYPERION_CLIENT_VERSION} };
        axios.get(this.state_endpoint, config)
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
                'SID': this.sid,
                'version': HYPERION_CLIENT_VERSION
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

    frameDecode(buffer) {
        let cursor = 0;
        let decodedData = {};
        const validHeaders = ['TIM', 'SPK', 'REQ', 'IDX', 'ANS', 'PCM', 'IMG'];
        while (buffer.length > 0) {
            try {
                let chunkHeader = new TextDecoder().decode(buffer.subarray(cursor, cursor + 3));
                cursor += 3;
                if (validHeaders.indexOf(chunkHeader) === -1) {
                    console.error('Invalid header');
                    break;
                }

                if (chunkHeader === 'TIM') {
                    decodedData['TIM'] = buffer.subarray(cursor, cursor + 8).readDoubleLE();
                    cursor += 8;
                } else {
                    let chunkSize = buffer.subarray(cursor).readInt32BE(0);
                    cursor += 4;
                    let chunkContent = buffer.subarray(cursor, cursor + chunkSize);

                    if (chunkContent.length < chunkSize) {
                        console.warn('Date frame is not complete');
                        break;
                    }

                    // buffer = buffer.subarray(7 + chunkSize);
                    cursor += chunkSize;
                    if (chunkHeader === 'REQ' || chunkHeader === 'SPK') {
                        chunkContent = new TextDecoder().decode(chunkContent);
                        decodedData[chunkHeader] = chunkContent;
                    } else if(chunkHeader === 'ANS') {
                        decodedData['IDX'] = chunkContent.readInt8(0);
                        chunkContent = new TextDecoder().decode(chunkContent.subarray(1));
                        decodedData[chunkHeader] = chunkContent;
                    } else if (chunkHeader === 'PCM' || chunkHeader === 'IMG') {
                        decodedData[chunkHeader] = chunkContent;
                    }

                    if (validHeaders.toString() === Object.keys(decodedData).toString()) {
                        this.handleDecoded(decodedData);
                        // Remove consumed data
                        decodedData = {};
                        buffer = buffer.subarray(cursor);
                        cursor = 0;
                    }
                }
            } catch (e) {
                console.error(`Error occurred during frameDecode : ${e}`);
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
        const img = data['IMG'];
        console.log(`\x1b[33m ${req} \x1b[0m`);
        console.log(`\x1b[36m ${ans} \x1b[0m`);

        if (pcm.length > 0) {
            const wavData = wavConverter.encodeWav(pcm, {
                byteRate: 16,
                numChannels: 1,
                sampleRate: 24000
            });
            this.play(time, idx, Readable.from(wavData));
        }

        if (img.length > 0) {
            this.imgCallback(img);
        }
    }
}


module.exports = VoiceTranscriptor;