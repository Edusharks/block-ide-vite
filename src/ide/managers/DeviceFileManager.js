// src/renderer/managers/DeviceFileManager.js (FINAL, HANG-FREE VERSION)
'use strict';

export class DeviceFileManager {
    constructor(commManager, ideInstance) {
        this.commManager = commManager;
        this.ide = ideInstance; 

        this.ui = {
            fileManagerModal: document.getElementById('file-manager-modal'),
            fileManagerCloseBtn: document.getElementById('file-manager-close-btn'),
            fileManagerRefreshBtn: document.getElementById('file-manager-refresh-btn'),
            fileManagerUploadBtn: document.getElementById('file-manager-upload-btn'),
            fileManagerUploadInput: document.getElementById('file-manager-upload-input'),
            fileListContainer: document.getElementById('file-list-container'),
            breadcrumbs: document.getElementById('file-manager-breadcrumbs'),
            exportProjectBtn: document.getElementById('export-project-btn'),
            saveToDeviceBtn: document.getElementById('save-to-device-btn'),
            cleanUploadBtn: document.getElementById('clean-upload-btn'),
            deviceInfoBtn: document.getElementById('device-info-btn'),
            deviceInfoModal: document.getElementById('device-info-modal'),
            deviceInfoCloseBtn: document.getElementById('device-info-close-btn'),
            deviceInfoContent: document.getElementById('device-info-content'),
            libraryManagerBtn: document.getElementById('library-manager-btn'),
            libraryManagerModal: document.getElementById('library-manager-modal'),
            libraryManagerCloseBtn: document.getElementById('library-manager-close-btn'),
            libraryListContainer: document.getElementById('library-list-container'),
        };
        
        this.currentDevicePath = '/';
        this.availableLibraries = [
            { name: 'ssd1306', description: 'Driver for monochrome 128x64 SSD1306 OLED displays (I2C).', url: 'https://raw.githubusercontent.com/micropython/micropython-lib/master/micropython/drivers/display/ssd1306/ssd1306.py' },
            { name: 'dht', description: 'Driver for DHT11/DHT22 temperature and humidity sensors.', url: 'https://raw.githubusercontent.com/micropython/micropython-lib/master/micropython/drivers/sensor/dht/dht.py' },
            { name: 'hcsr04', description: 'Driver for HC-SR04 ultrasonic distance sensors.', url: 'https://raw.githubusercontent.com/rsc1975/micropython-hcsr04/master/hcsr04.py' },
            { name: 'bme280', description: 'Driver for BME280 temperature, humidity, and pressure sensors (I2C).', url: 'https://raw.githubusercontent.com/robert-hh/BME280/master/bme280.py' },
            { name: 'mpu6050', description: 'Driver for MPU-6050 accelerometer and gyroscope (I2C).', url: 'https://raw.githubusercontent.com/m-rtijn/mpu6050/main/mpu6050.py' },
            { name: 'neopixel', description: 'Driver for WS2812B (NeoPixel) addressable RGB LEDs.', url: 'https://raw.githubusercontent.com/micropython/micropython-lib/master/micropython/drivers/led/neopixel/neopixel.py' },
            { name: 'servo', description: 'A simple helper library for controlling servo motors.', url: 'https://raw.githubusercontent.com/micropython-IMU/micropython-servo/master/servo.py' },
            { name: 'urequests', description: 'Library for making HTTP web requests (GET, POST, etc.).', url: 'https://raw.githubusercontent.com/micropython/micropython-lib/master/micropython/urequests/urequests.py' },
            { name: 'umqtt_simple', description: 'A simple and robust client for MQTT, a core IoT protocol.', url: 'https://raw.githubusercontent.com/micropython/micropython-lib/master/micropython/umqtt.simple/umqtt/simple.py' },
            { name: 'i2c_scanner', description: 'A utility script to scan the I2C bus and find connected device addresses.', url: 'https://raw.githubusercontent.com/scan-build/micropython-i2c-scanner/master/i2c_scanner.py' }
        ];
    }
    
    init() {
        this.ui.fileManagerCloseBtn.addEventListener('click', () => this.close());
        this.ui.fileManagerRefreshBtn.addEventListener('click', () => this.fetchAndRenderFileList());
        this.ui.fileManagerUploadBtn.addEventListener('click', () => this.ui.fileManagerUploadInput.click());
        this.ui.fileManagerUploadInput.addEventListener('change', (e) => this.uploadSelectedFileToDevice(e.target.files[0]));
        this.ui.exportProjectBtn.addEventListener('click', () => this.ide.exportProject());
        this.ui.saveToDeviceBtn.addEventListener('click', () => this.saveCodeToDevice());
        this.ui.cleanUploadBtn.addEventListener('click', () => this.cleanAndUpload());
        this.ui.deviceInfoBtn.addEventListener('click', () => this.showDeviceInfo());
        this.ui.deviceInfoCloseBtn.addEventListener('click', () => this.ui.deviceInfoModal.style.display = 'none');
        this.ui.libraryManagerBtn.addEventListener('click', () => this.showLibraryManager());
        this.ui.libraryManagerCloseBtn.addEventListener('click', () => this.ui.libraryManagerModal.style.display = 'none');
    }

    async performAtomicDeviceOperation(asyncFn) {
        if (!this.commManager.isConnected()) throw new Error("Device is not connected.");
        await this.commManager.stopReadLoop();
        await new Promise(resolve => setTimeout(resolve, 50)); 

        try {
            return await asyncFn();
        } catch (error) {
            console.error("An error occurred during an atomic device operation:", error);
            throw error;
        } finally {
            this.commManager.startReadLoop();
        }
    }


    log(message, type = 'info') { this.ide.addConsoleMessage(message, type); }
    

    open() {
        if (!this.commManager.isConnected()) {
            return alert("Connect to a device to manage files.");
        }
        this.currentDevicePath = '/';
        this.ui.fileManagerModal.style.display = 'flex';
        this.fetchAndRenderFileList();
    }

    close() {
        this.ui.fileManagerModal.style.display = 'none';
    }

   async uploadProject(projectFiles) {
        return this.performAtomicDeviceOperation(async () => {
            const hasLibDir = Object.keys(projectFiles).some(path => path.startsWith('lib/'));
            if (hasLibDir) {
                this.log('Ensuring /lib directory exists...');
                await this.commManager.sendCommandAndGetResponse("import os; os.mkdir('lib') if 'lib' not in os.listdir() else None");
            }
            for (const [filePath, fileContent] of Object.entries(projectFiles)) {
                this.log(`Uploading ${filePath}...`);
                await this._uploadFileInChunks(filePath, fileContent);
            }
        });
    }

    async _uploadFileInChunks(fileName, fileContent) {
        const CHUNK_SIZE = 256;
        await this.commManager.sendCommandAndGetResponse(`f = open('${fileName}', 'w')`);
        for (let i = 0; i < fileContent.length; i += CHUNK_SIZE) {
            const chunk = fileContent.substring(i, i + CHUNK_SIZE);
            const escapedChunk = JSON.stringify(chunk);
            await this.commManager.sendCommandAndGetResponse(`f.write(${escapedChunk})`);
        }
        await this.commManager.sendCommandAndGetResponse(`f.close()`);
    }

    async fetchAndRenderFileList() {
        this.ui.fileListContainer.innerHTML = `<p style="padding: 1rem;">Loading files from ${this.currentDevicePath}...</p>`;
        this.renderBreadcrumbs();
        try {
            const items = await this.performAtomicDeviceOperation(async () => {
                const command = `import os, ujson; print(ujson.dumps([(i, os.stat('${this.currentDevicePath}' + i)[0] & 0x4000 != 0) for i in os.listdir('${this.currentDevicePath}')]))`;
                const response = await this.commManager.sendCommandAndGetResponse(command, 15000);
                return JSON.parse(response.replace(/'/g, '"').replace(/True/g, 'true').replace(/False/g, 'false'));
            });
            this.renderFileList(items);
        } catch (e) {
            this.ui.fileListContainer.innerHTML = `<p style="padding: 1rem; color: var(--accent-error);">Error fetching files: ${e.message}</p>`;
        }
    }

    renderBreadcrumbs() {
        const container = this.ui.breadcrumbs;
        container.innerHTML = '';
        const pathParts = this.currentDevicePath.split('/').filter(p => p);
        
        const rootEl = document.createElement('span');
        rootEl.textContent = 'Device > ';
        rootEl.onclick = () => {
            this.currentDevicePath = '/';
            this.fetchAndRenderFileList();
        };
        container.appendChild(rootEl);

        let currentPath = '';
        pathParts.forEach((part, index) => {
            currentPath += '/' + part;
            const partEl = document.createElement('span');
            partEl.textContent = `${part} > `;
            
            if (index < pathParts.length - 1) {
                const clickablePath = currentPath;
                partEl.onclick = () => {
                    this.currentDevicePath = clickablePath;
                    this.fetchAndRenderFileList();
                };
            }
            container.appendChild(partEl);
        });
    }
    
    renderFileList(items) {
        const container = this.ui.fileListContainer;
        container.innerHTML = ''; 

        items.sort((a, b) => {
            if (a[1] && !b[1]) return -1; // Directory vs file
            if (!a[1] && b[1]) return 1; // File vs directory
            return a[0].localeCompare(b[0]); // Alphabetical
        });

        if (items.length === 0) {
            container.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">This directory is empty.</p>';
            return;
        }

        items.forEach(([itemName, isDir]) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'file-list-item';
            itemEl.innerHTML = `
                <div class="file-name">
                    <span>${isDir ? '📁' : '📄'}</span>
                    <span>${itemName}</span>
                </div>
                <div class="file-actions"></div>
            `;
            
            const nameEl = itemEl.querySelector('.file-name');
            const actionsEl = itemEl.querySelector('.file-actions');

            if (isDir) {
                nameEl.style.cursor = 'pointer';
                nameEl.onclick = () => {
                    this.currentDevicePath = this.currentDevicePath === '/' ? `/${itemName}` : `${this.currentDevicePath}/${itemName}`;
                    this.fetchAndRenderFileList();
                };
            } else {
                const openBtn = document.createElement('button');
                openBtn.className = 'btn secondary';
                openBtn.textContent = 'Open';
                openBtn.onclick = () => this.openFileFromDevice(itemName);
                actionsEl.appendChild(openBtn);

                if (itemName.endsWith('.py')) {
                    const runBtn = document.createElement('button');
                    runBtn.className = 'btn secondary';
                    runBtn.textContent = 'Run';
                    runBtn.onclick = () => this.runFileOnDevice(itemName);
                    actionsEl.appendChild(runBtn);
                }
            }
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn danger';
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteFileOnDevice(itemName, isDir);
            };
            actionsEl.appendChild(deleteBtn);
            
            container.appendChild(itemEl);
        });
    }

    async openFileFromDevice(fileName) {
        this.log(`Reading ${fileName} from device...`);
        try {
            const content = await this.performAtomicDeviceOperation(async () => {
                const fullPath = this.currentDevicePath === '/' ? `/${fileName}` : `${this.currentDevicePath}/${fileName}`;
                const command = `with open('${fullPath}', 'r') as f: print(f.read())`;
                return await this.commManager.sendCommandAndGetResponse(command);
            });
            this.ide.loadCodeIntoEditor(fileName, content);
            this.close();
        } catch (e) {
            this.log(`Error reading file: ${e.message}`, 'error');
            alert(`Could not read file "${fileName}". Check the console.`);
        }
    }

    async runFileOnDevice(fileName) {
        const fullPath = this.currentDevicePath === '/' ? `/${fileName}` : `${this.currentDevicePath}/${fileName}`;
        if (!fullPath.endsWith('.py')) return;
        this.log(`>>> Executing ${fullPath} on device...`, 'input');
        this.ide.switchView('console');
        this.close();
        const command = `exec(open('${fullPath}').read())\r\n`;
        try {
            await this.commManager.sendData('\x03'); await new Promise(r => setTimeout(r, 100));
            await this.commManager.sendData(command);
        } catch (e) {
            this.log(`Error running file: ${e.message}`, 'error');
        }
    }

    async deleteFileOnDevice(itemName, isDir) {
        if (!confirm(`Are you sure you want to delete ${itemName}? This cannot be undone.`)) return;
        try {
            await this.performAtomicDeviceOperation(async () => {
                const fullPath = this.currentDevicePath === '/' ? `/${itemName}` : `${this.currentDevicePath}/${itemName}`;
                const command = `import os; os.${isDir ? 'rmdir' : 'remove'}('${fullPath}')`;
                await this.commManager.sendCommandAndGetResponse(command);
                this.log(`Deleted ${fullPath} successfully.`, 'success');
            });
            await this.fetchAndRenderFileList();
        } catch (e) {
            this.log(`Error deleting item: ${e.message}`, 'error');
        }
    }

    async saveCodeToDevice() {
        const fileName = prompt("Enter filename to save on device:", this.ide.activeFile || "main.py");
        if (!fileName) return;
        try {
            await this.performAtomicDeviceOperation(async () => {
                this.log(`Saving current code to ${fileName}...`, 'info');
                await this._uploadFileInChunks(fileName, this.ide.currentCode);
                this.log(`Successfully saved code to ${fileName}.`, 'success');
            });
            await this.fetchAndRenderFileList();
        } catch (e) {
            this.log(`Error saving file to device: ${e.message}`, 'error');
        }
    }
    
    async cleanAndUpload() {
        if (!confirm("Are you sure you want to DELETE ALL .py FILES from the device?")) return;
        try {
            await this.performAtomicDeviceOperation(async () => {
                this.log('Wiping .py files from device...', 'warning');
                const command = `import os\nfor f in os.listdir('/'):\n  if f.endswith('.py'): os.remove(f)`;
                await this.commManager.sendCommandAndGetResponse(command);
                this.log('Device cleaned successfully.', 'success');
            });
            await new Promise(r => setTimeout(r, 200));
            this.ide.uploadCodeToDevice();
        } catch (e) {
            this.log(`Error cleaning device: ${e.message}`, 'error');
            alert("Failed to clean the device. Upload aborted.");
        }
    }

    async showDeviceInfo() {
        this.ui.deviceInfoModal.style.display = 'flex';
        this.ui.deviceInfoContent.innerHTML = `<p class="device-info-loading">Querying device...</p>`;
        let resultsHtml = '';
        try {
            await this.performAtomicDeviceOperation(async () => {
                const commands = [
                    { label: 'MicroPython Version', command: "import sys; print(sys.implementation)" },
                    { label: 'Board/OS Info', command: "import os; print(os.uname())" },
                    { label: 'CPU Frequency', command: "import machine; print(f'{machine.freq() / 1000000} MHz')" },
                    { label: 'Memory Info', command: "import micropython; print(micropython.mem_info())" },
                    { label: 'Wi-Fi IP Address', command: "import network; wlan = network.WLAN(network.STA_IF); print(wlan.ifconfig()[0] if wlan.isconnected() else 'Not Connected')" }
                ];
                for (const item of commands) {
                    let value = 'N/A';
                    try {
                        value = await this.commManager.sendCommandAndGetResponse(item.command, 2000);
                    } catch (e) { console.warn(`Could not get info for '${item.label}':`, e.message); }
                    resultsHtml += `<div class="device-info-item"><span class="device-info-label">${item.label}</span><span class="device-info-value">${value}</span></div>`;
                }
            });
            this.ui.deviceInfoContent.innerHTML = resultsHtml;
        } catch (e) {
            this.ui.deviceInfoContent.innerHTML = `<p style="color:var(--accent-error)">Failed to get device info: ${e.message}</p>`;
        }
    }

    showLibraryManager() {
        this.ui.libraryListContainer.innerHTML = '';
        this.availableLibraries.forEach(lib => {
            const itemEl = document.createElement('div');
            itemEl.className = 'library-item';
            itemEl.innerHTML = `
                <div class="library-info">
                    <h4>${lib.name}.py</h4>
                    <p>${lib.description}</p>
                </div>
                <div class="library-actions">
                    <button class="btn primary install-btn" data-name="${lib.name}" data-url="${lib.url}">Add to Project</button>
                </div>
            `;
            this.ui.libraryListContainer.appendChild(itemEl);
        });

        this.ui.libraryListContainer.querySelectorAll('.install-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const { name, url } = e.target.dataset;
                e.target.textContent = 'Adding...';
                e.target.disabled = true;
                this.installLibrary(name, url).finally(() => {
                    e.target.textContent = 'Add to Project';
                    e.target.disabled = false;
                });
            });
        });

        this.ui.libraryManagerModal.style.display = 'flex';
    }

    async installLibrary(libName, libUrl) {
        this.log(`Downloading ${libName}.py...`);
        try {
            const response = await fetch(libUrl);
            if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
            const libCode = await response.text();
            this.log(`Download complete. Adding to project...`);

            const filePath = `lib/${libName}.py`;
            if (this.ide.projectFiles[filePath]) {
                if (!confirm(`Library "${libName}.py" already exists. Overwrite it?`)) {
                    this.log('Installation cancelled.', 'info');
                    return;
                }
            }
            this.ide.projectFiles[filePath] = libCode;

            await this.ide.saveWorkspaceToCache();
            this.ide.renderFileTree();

            this.log(`✅ Added ${libName}.py to your project's /lib folder.`, 'success');
            alert(`${libName}.py has been added. It will be uploaded the next time you sync the project.`);

        } catch (e) {
            this.log(`❌ Error installing library: ${e.message}`, 'error');
            alert(`Failed to install ${libName}.py. Check the console for details.`);
        }
    }
    
    async uploadSelectedFileToDevice(file) {
        if (!file) return;
        const fullPath = this.currentDevicePath === '/' ? `/${file.name}` : `${this.currentDevicePath}/${file.name}`;
        
        try {
            const fileContent = await file.text();
            await this.performAtomicDeviceOperation(async () => {
                this.log(`Uploading to ${fullPath}...`);
                await this._uploadFileInChunks(fullPath, fileContent);
                this.log(`Successfully uploaded to ${fullPath}.`, 'success');
            });
            await this.fetchAndRenderFileList();
        } catch (e) {
            this.log(`Error uploading file: ${e.message}`, 'error');
        } finally {
            this.ui.fileManagerUploadInput.value = '';
        }
    }
}