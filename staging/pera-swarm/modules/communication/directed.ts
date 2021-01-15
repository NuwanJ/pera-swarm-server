import { abs } from 'mathjs';
import { Route } from '../../../mqtt-router';
import { CoordinateValueInt } from '../coordinate';
import { Robots } from '../robots';
import { Communication } from './';

export class DirectedCommunication extends Communication {
    protected _angleThreshold: number;

    constructor(
        robots: Robots,
        mqttPublish: Function,
        maxDistance: number,
        angleThreshold: number = 30,
        debug: boolean = false
    ) {
        super(robots, mqttPublish, maxDistance, debug);
        this._angleThreshold = angleThreshold;
        if (this._debug) {
            console.log('DirectedCommunication:Debug:', this._debug);
        }
    }

    /**
     * broadcast method
     * @param robotId {TId} robot id
     * @param message {string} message
     * @param callback {Function} callback function
     */
    broadcast = (robotId: string, message: string, callback: Function) => {
        if (robotId === undefined) throw new TypeError('robotId unspecified');
        if (message === undefined) throw new TypeError('message unspecified');

        const allCoordinates = this._robots.getCoordinatesAll();
        const thisCoordinate = this._robots.getCoordinatesById(Number(robotId));
        var receivers = 0;

        allCoordinates.forEach(
            (coordinate: CoordinateValueInt<number>, index: number) => {
                if (thisCoordinate !== -1 && coordinate.id != thisCoordinate.id) {
                    const distCheck = this.distanceCheck(
                        this._getDistance(thisCoordinate, coordinate)
                    );
                    const angleCheck = this.angleCheck(
                        thisCoordinate.heading,
                        this._getAngle(thisCoordinate, coordinate)
                    );

                    if (distCheck && angleCheck) {
                        // within the distance range & angle threshold, so send the messaage
                        receivers++;
                        if (this._debug) console.log(`robot #${coordinate.id}: pass`);
                        this._mqttPublish(`/communication/${coordinate.id}`, message);
                    }
                }
            }
        );

        if (callback != undefined) callback({ receivers: receivers });
    };

    /*
     * method contains the default subscription topics of the module.
     * this will be handled by mqtt-router
     */
    defaultSubscriptions = (): Route[] => {
        return [
            {
                topic: 'comm/out/directional',
                type: 'JSON',
                allowRetained: false,
                subscribe: true,
                publish: false,
                handler: (msg: any) => {
                    // The robots can transmit messages to other robots using a transmission protocol.
                    // Server will decide the robots who can receive the message
                    console.log('MQTT.Comm: comm/out/directional', msg);
                    
                    this.broadcast(msg.id, msg.msg, (data: any) => {
                        console.log('Sent to', data.receivers, 'robots');
                    });
                }
            }
        ];
    };

    /**
     * method for checking the given angle value is within the accepted value range
     * @param {number} heading heading value
     * @param {number} angle angle value
     * @returns {boolean} the verification of angle
     */
    angleCheck = (heading: number, angle: number): boolean => {
        // Get the absolute difference between robot heading and target robot's absolute angle
        var difference = (angle - heading) % 360;
        if (difference <= -180) difference += 360;
        if (difference > 180) difference -= 360;

        if (this._debug)
            console.log(`heading: ${heading}, angle:${angle}, diff:${difference}`);

        return abs(difference) <= this._angleThreshold / 2;
    };
}
