const { OpenAIApi, Configuration } = require('openai');
const { OPENAI_TOKEN } = require('../../config.json');

class OpenAI {

    constructor() {
        this.api = new OpenAIApi(new Configuration({apiKey: OPENAI_TOKEN}));
        this.context = [
            "Ce qui suit est une conversation avec un assistant IA nommé ReBOTed. L'assistant est serviable, créatif, intelligent et vraiment amical.",
            "<Humain>: Bonjour, qui es-tu ?",
            "ReBOTed: Je suis une IA créée par OpenAI. Comment puis-je t'aider aujourd'hui ?"
        ];
        this.max_memory = 400;
        this.memory = {};
        this.custom_context = {};
    }

    setContext(username, context) {
        this.custom_context[username] = [context];
        this.memory[username] = [];
    }

    clearContext(username) {
        delete this.custom_context[username];
        this.memory[username] = [];
    }

    clearMemory(username) {
        this.memory[username] = [];
    }

    answer(username, question) {
        if (this.memory[username] === undefined) {
            this.memory[username] = [];
        }
        else if (this.memory[username].length === this.max_memory) {
            this.memory[username].shift();
        }

        let context = this.context.join('\n').replace('<Humain>', username);
        context = `${context}\n`;

        let newMemory = ` ${username}: ${question}`;
        let stop_tokens = [` ${username}:`, " ReBOTed:"];
        if (this.custom_context[username] !== undefined) {
            context = this.custom_context[username].join('');
            if (context.indexOf('<Humain>') > -1 || context.indexOf('ReBOTed') > -1) {
                context = context.replace('<Humain>', username);
            } else {
                newMemory = question;
                stop_tokens = ['.', '...', '!', '?'];
            }
        }

        this.memory[username].push(newMemory);
        let prompt_str = `${context}${this.memory[username].join('\n')}`;
        prompt_str = `${prompt_str}\n`;
        console.log(prompt_str);

        return new Promise((resolve, reject) => {
            this.api.createCompletion({
                model: 'text-davinci-002',
                prompt: prompt_str,
                temperature: 0.9,
                max_tokens: 250,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0.6,
                stop: stop_tokens,
            }).then((res) => {
                let answer;
                if (stop_tokens.indexOf(' ReBOTed:') > -1) {
                    let raw_answer = res.data.choices[0].text.split('ReBOTed:');
                    answer = raw_answer[0];
                    if (raw_answer.length > 1) {
                        answer = raw_answer[1];
                    }

                    answer = answer.trim();
                    this.memory[username].push(`ReBOTed: ${answer}`);
                } else {
                    answer = res.data.choices[0].text;
                    this.memory[username].push(answer);
                }

                resolve(answer);
            }).catch((err) => {
                reject(err);
                console.error(err);
            });
        });

    }
}

module.exports = new OpenAI();