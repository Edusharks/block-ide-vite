// src/renderer/utils/webrepl.js (FINAL, with Uniform Interface)

export class WebREPLCommunication {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.onDataCallback = null;
        this.onDisconnectCallback = null;
    }

    async connect(host, port = 8266) {
        // ... (This entire function remains the same as the last debug version)
        return new Promise((resolve, reject) => {
            console.log(`[DEBUG] 1. 'connect' function called with host: ${host}`);

            if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
                console.log("[DEBUG] 2. An old WebSocket was found. Closing it before proceeding.");
                this.ws.onclose = null; 
                this.ws.close();
            }

            let connectTimeout;
            
            console.log(`[DEBUG] 3. Attempting to create new WebSocket with URL: ws://${host}:${port}/`);
            try {
                this.ws = new WebSocket(`ws://${host}:${port}/`);
            } catch (e) {
                console.error("[DEBUG] FATAL: 'new WebSocket()' constructor failed.", e);
                return reject(e);
            }

            const cleanupListeners = () => {
                console.log("[DEBUG] 6. Cleaning up temporary event listeners and timeout.");
                clearTimeout(connectTimeout);
                this.ws.onopen = null;
                this.ws.onmessage = null;
                this.ws.onerror = null;
            };

            connectTimeout = setTimeout(() => {
                console.error("[DEBUG] 9. TIMEOUT! The 15-second timer fired. No successful connection was made.");
                cleanupListeners();
                this.ws.close(); 
                reject(new Error('Connection timeout. The device did not respond in time.'));
            }, 15000);

            console.log("[DEBUG] 4. Event listeners and a 15-second timeout are now set.");

            this.ws.onopen = () => {
                console.log("[DEBUG] 5a. ONOPEN event fired! The network link is open. Waiting for the 'Password:' prompt from the device.");
            };

            this.ws.onmessage = (event) => {
                console.log("[DEBUG] 7. ONMESSAGE event fired! Received data:", event.data);
                if (this.onDataCallback) {
                    this.onDataCallback(event.data);
                }
                if (event.data.includes('Password:')) {
                    cleanupListeners();
                    this.isConnected = true;
                    console.log("[DEBUG] 8. SUCCESS! 'Password:' prompt received. Resolving promise.");
                    resolve({ success: true, message: 'Connected via WebREPL.' });
                }
            };

            this.ws.onerror = (error) => {
                console.error("[DEBUG] 5b. ONERROR event fired! This is a critical failure.", error);
                cleanupListeners();
                reject(new Error('WebSocket connection failed. Check browser console for details.'));
            };

            this.ws.onclose = (event) => {
                cleanupListeners();
                this.isConnected = false;
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback();
                }
            };
        });
    }


    startReadLoop() { }
    stopReadLoop() {  }

    async readUntil(terminator, timeout = 5000) {
        if (!this.isConnected) throw new Error("Not connected.");
        return new Promise((resolve, reject) => {
            let buffer = '';
            let silenceTimer;

            const overallTimeout = setTimeout(() => {
                this.onDataCallback = originalOnData; // Restore
                reject(new Error(`Overall read timed out after ${timeout}ms. No data received.`));
            }, timeout);

            const originalOnData = this.onDataCallback;

            const onData = (data) => {
                if (originalOnData) {
                    originalOnData(data);
                }
                buffer += data;
                clearTimeout(silenceTimer);
                silenceTimer = setTimeout(() => {
                    this.onDataCallback = originalOnData; // Restore the original listener
                    clearTimeout(overallTimeout); // We're done, so clear the main timeout
                    if (buffer.includes(terminator)) {
                        resolve(buffer);
                    } else {
                        reject(new Error(`Did not receive expected response "${terminator}" in buffer.`));
                    }
                }, 50);
            };

            this.onDataCallback = onData;
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
        this.isConnected = false;
    }
    sendData(data) {
        if (!this.isConnected || !this.ws) {
            throw new Error('Not connected to WebREPL');
        }
        this.ws.send(data);
    }
    onData(callback) {
        this.onDataCallback = callback;
    }
    onDisconnect(callback) {
        this.onDisconnectCallback = callback;
    }
async enterRawREPL() { return Promise.reject("Raw REPL is not supported over WebREPL."); }
    async exitRawREPL() { return Promise.reject("Raw REPL is not supported over WebREPL."); }
    async rawREPL_execute(command, timeout = 5000) { return Promise.reject("Raw REPL is not supported over WebREPL."); }
    async sendCommandAndGetResponse(command, timeout = 5000) { return Promise.reject("Raw REPL is not supported over WebREPL."); }
}