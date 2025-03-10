import { IClientSubscribeOptions, MqttClient } from 'mqtt';
import queue from 'queue';
import { logLevel } from './config';
import { resolveChannelTopic } from './helper';

type MessageType = {
    topic: string;
    data: string | Buffer;
};

class Message {
    topic: string;
    data: string | Buffer;
    constructor(topic: string, data: string | Buffer) {
        this.topic = topic;
        this.data = data;
    }
}

const defaultOptions: IClientSubscribeOptions = { qos: 2, rap: true, nl: true };

interface AbstractQueue {
    _mqttClient: MqttClient;
    _mqttOptions: IClientSubscribeOptions;
    _queue: queue;
    _schedulerInterval: number;
    add: Function;
    publish: Function;
    start: Function;
    stop: Function;
    end: Function;
}

export class Queue implements AbstractQueue {
    _mqttClient: MqttClient;
    _mqttOptions: IClientSubscribeOptions;
    _queue: queue;
    _schedulerInterval: number;

    constructor(
        mqttClient: MqttClient,
        options: IClientSubscribeOptions = defaultOptions,
        interval: number = 1000
    ) {
        this._mqttClient = mqttClient;
        this._mqttOptions = options;
        this._schedulerInterval = interval;
        this._queue = queue({ results: [] });
        this._queue.timeout = this._schedulerInterval;
        this._queue.autostart = true;
        this._queue.on('success', function (result) {
            if (logLevel !== 'info') {
                console.log('Queue processed: > ', result);
            }
        });
        this._queue.on('timeout', function (next, job) {
            if (logLevel !== 'info') {
                console.log('Queue timed out:', job.toString().replace(/\n/g, ''));
            }
            next();
        });
    }

    /**
     * method for starting queue processing
     */
    start = () => {
        this._queue.start((error) => {
            // This callback will be called when the queue processing encounters an error or
            // finished processing all the workers in the queue
            if (error !== undefined) {
                console.error(error);
            }
            if (logLevel !== 'info') {
                console.log('Queue finished processing:', this._queue.results);
            }
        });
    };

    /**
     * method for adding a message to the queue
     * @param {string} topic
     * @param {string|Buffer} data message data
     */
    add = (topic: string, data: string | Buffer): void => {
        this._queue.push((callback) => {
            this.publish(new Message(topic, data));
            if (logLevel !== 'info') {
                console.log('Added_To_Queue', `{topic: '${topic}', data: '${data}}'`);
            }
            if (callback !== undefined) {
                callback(undefined, data);
            }
        });
    };

    /**
     * method for publishing a message in the queue
     * @param {Message} message message to be published
     */
    publish = (message: Message) => {
        if (logLevel !== 'info') {
            console.log(
                'MQTT_Publish >',
                message,
                'to topic:',
                resolveChannelTopic(message.topic)
            );
        }
        this._mqttClient.publish(
            resolveChannelTopic(message.topic),
            message.data,
            this._mqttOptions
        );
    };

    /**
     * method for stoping queue processing
     */
    stop = () => {
        this._queue.stop();
    };

    /**
     * method for stoping and emptying the queue immediately
     * @param {any} error error description
     * @param {Function} callback callback function
     */
    end = (error: any, callback: Function) => {
        this._queue.end(error);
        callback();
    };
}
