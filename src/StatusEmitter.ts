import {EventEmitter} from "node:events";

class StatusEmitter extends EventEmitter {
    constructor() {
        super();
    }
}

export default new StatusEmitter();