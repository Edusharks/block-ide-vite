// src/renderer/utils/ble-comm.js

// Standard Nordic UART Service (NUS) UUIDs
const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // To ESP32
const NUS_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // From ESP32

export class BLECommunication {
    constructor() {
        this.device = null;
        this.server = null;
        this.rxCharacteristic = null;
        this.txCharacteristic = null;
        this.isConnected = false;
        this.onDataCallback = null;
        this.onDisconnectCallback = null;
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder();
    }

    async scan() {
        if (!navigator.bluetooth) {
            throw new Error('Web Bluetooth API is not available in this browser.');
        }

        console.log('Requesting Bluetooth device with Nordic UART Service...');
        this.device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [NUS_SERVICE_UUID] }],
            optionalServices: [NUS_SERVICE_UUID] // Required for some browsers
        });

        if (!this.device) {
            throw new Error('No device selected.');
        }

        this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));
        return this.device;
    }

    async connect(device) {
        if (!device) throw new Error("Device not provided.");
        this.device = device;
        
        console.log('Connecting to GATT Server...');
        this.server = await this.device.gatt.connect();

        console.log('Getting Nordic UART Service...');
        const service = await this.server.getPrimaryService(NUS_SERVICE_UUID);

        console.log('Getting Characteristics...');
        this.rxCharacteristic = await service.getCharacteristic(NUS_RX_CHAR_UUID);
        this.txCharacteristic = await service.getCharacteristic(NUS_TX_CHAR_UUID);

        console.log('Starting notifications on TX Characteristic...');
        await this.txCharacteristic.startNotifications();
        this.txCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotifications.bind(this));

        this.isConnected = true;
        console.log('BLE Connected and Ready.');
    }

    handleNotifications(event) {
        const value = event.target.value;
        const data = this.decoder.decode(value);
        if (this.onDataCallback) {
            this.onDataCallback(data);
        }
    }

    async sendData(data) {
        if (!this.rxCharacteristic) {
            throw new Error('Not connected or RX characteristic not found.');
        }
        // Web Bluetooth works best with smaller chunks
        const chunkSize = 20;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.substring(i, i + chunkSize);
            await this.rxCharacteristic.writeValueWithoutResponse(this.encoder.encode(chunk));
        }
    }

    disconnect() {
        if (this.server && this.server.connected) {
            this.server.disconnect();
        } else {
            this.handleDisconnect();
        }
    }

    handleDisconnect() {
        console.log('BLE device disconnected.');
        this.isConnected = false;
        this.device = null;
        this.server = null;
        this.rxCharacteristic = null;
        this.txCharacteristic = null;
        if (this.onDisconnectCallback) {
            this.onDisconnectCallback();
        }
    }

    onData(callback) { this.onDataCallback = callback; }
    onDisconnect(callback) { this.onDisconnectCallback = callback; }
    
    // Required for compatibility with the IDE's communication structure
    startReadLoop() {}
    stopReadLoop() {}

     async enterRawREPL() { return Promise.reject("Raw REPL is not supported over BLE."); }
    async exitRawREPL() { return Promise.reject("Raw REPL is not supported over BLE."); }
    async rawREPL_execute(command, timeout = 5000) { return Promise.reject("Raw REPL is not supported over BLE."); }
    async sendCommandAndGetResponse(command, timeout = 5000) { return Promise.reject("Raw REPL is not supported over BLE."); }
    
}