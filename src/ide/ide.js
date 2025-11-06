// src/renderer/ide.js (Refactored Skeleton)
'use strict';

// --- UTILITY & DATA IMPORTS ---
import { getWorkspace, saveWorkspace, getExtensions, saveExtensions, saveProject, getAllProjects, deleteProjectByName } from '../shared/utils/db.js';
import { ideTutorials as tutorials } from './ide-tutorials.js';
import { showCustomPrompt, showCustomConfirm } from '../shared/utils/modals.js';

import { CommunicationManager } from './managers/CommunicationManager.js';
import { AiVisionManager } from './managers/AiVisionManager.js';
import { DeviceFileManager } from './managers/DeviceFileManager.js';
import { DashboardBuilder } from './managers/DashboardBuilder.js';
import { BlockGenius } from './managers/BlockGenius.js';

import * as monaco from 'monaco-editor';
import Chart from 'chart.js/auto';
import * as Blockly from 'blockly/core';
import { dialog } from 'blockly/core';
import * as pako from 'pako';
import JSZip from 'jszip';
import Shepherd from 'shepherd.js';

// --- URL SAFE BASE64 HELPERS ---
function toBase64URL(u8) {
    return btoa(String.fromCharCode.apply(null, u8))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function fromBase64URL(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
        str += '=';
    }
    const bin = atob(str);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        u8[i] = bin.charCodeAt(i);
    }
    return u8;
}

const DEFAULT_PROJECT = {
    'main.py': `<xml xmlns="https://developers.google.com/blockly/xml"><block type="on_start" id="start_block" x="100" y="50"></block><block type="forever" id="forever_block" x="100" y="220"></block></xml>`,
};


const EXTENSION_BLOCK_TYPES = {
    'face_landmark': [
        'face_landmark_enable', 
        'face_landmark_on_face_data', 
        'face_landmark_get_face_count', 
        'face_landmark_is_expression',
        'face_landmark_get_blendshape_value'
    ],
    'hand_gesture': [
        'hand_gesture_enable', 
        'hand_gesture_on_gesture', 
        'hand_gesture_get_hand_count', 
        'hand_gesture_is_hand_present'
    ],
    'image_classification': [
        'image_classification_enable', 
        'image_classification_on_class',
        'image_classification_is_class', 
        'image_classification_get_class'
    ],
    'object_detection': [
        'object_detection_enable', 
        'object_detection_on_object',
        'object_detection_is_object_detected', 
        'object_detection_for_each', 
        'object_detection_get_property'
    ],
    'custom_model': [
        'custom_model_setup',
        'custom_model_when_class',
        'custom_model_is_class'
    ],
    'iot_dashboard': [
        'dashboard_when_button_is',
        'dashboard_get_control_value',
        'dashboard_get_joystick_x',
        'dashboard_get_joystick_y',
        'dashboard_update_display',
        'dashboard_on_control_change',
        'dashboard_generated_html_content' 
    ],
    'neopixel': [
        'actuator_neopixel_setup', 'actuator_neopixel_brightness', 'actuator_neopixel_fill',
        'actuator_neopixel_set', 'actuator_neopixel_shift', 'actuator_neopixel_rainbow',
        'actuator_neopixel_clear', 'actuator_neopixel_show'
    ],
    'display': [
        'display_oled_setup', 'display_oled_text', 'display_oled_pixel', 'display_oled_line',
        'display_oled_rect', 'display_create_bitmap', 'display_oled_draw_image',
        'display_oled_show', 'display_oled_clear', 'display_oled_power',
        'display_oled_contrast', 'display_oled_invert', 'display_oled_animate_fireworks'
    ],
    'wifi': [
        'wifi_connect', 'wifi_is_connected', 'wifi_get_ip', 'http_get_json', 'json_get_key',
        'http_post_json', 'wifi_start_web_server', 'wifi_on_web_request',
        'wifi_get_web_request_path', 'wifi_send_web_response'
    ],
    'bluetooth': [
        'ble_setup', 'ble_advertise_data'
    ],
};


class ESP32BlockIDE {
    constructor(boardId, projectName, pythonGenerator) {
        // --- Core IDE State ---
        this.boardId = boardId;
        this.projectName = projectName;
        this.pythonGenerator = pythonGenerator;
        this.projectFiles = {};
        this.activeFile = 'main.py';
        this.currentCode = '';
        this.codeWithBlockIds = '';
        this.monacoEditor = null;
        this.isCodeOnlyMode = false;
        this.isLiveMode = false;
        this.loadedExtensions = new Set();
        this.blocklyManager = null;
        
        // --- UI State & Timers ---
        this.workspaceUpdateTimeout = null;
        this.consoleBuffer = [];
        this.isConsoleUpdateScheduled = false;

        // --- Configuration ---
        this.WORKSPACE_UPDATE_DEBOUNCE_MS = 250;
        this.CONSOLE_UPDATE_INTERVAL = 100;
        this.MAX_CONSOLE_LINES = 2000;
        this.MAX_PLOTTER_POINTS = 50;
        this.boardImageMap = {
              'esp32': new URL('../assets/ESP32.png', import.meta.url).href,
              'pico': new URL('../assets/Pico.png', import.meta.url).href
        };
        this.boardNameMap = { 'esp32': 'ESP32', 'pico': 'Pico' };
        this.availableExtensions = [
            { id: 'face_landmark', name: 'Face Landmark', description: 'Detect faces and expressions like smiling or blinking.', color: '#6d28d9', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12a3 3 0 100-6 3 3 0 000 6z"/><path d="M20.9 19.8A10 10 0 103.1 4.2"/></svg>` },
            { id: 'hand_gesture', name: 'Hand Gestures', description: 'Recognize hand gestures like thumbs-up and pointing.', color: '#d97706', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>` },
            { id: 'image_classification', name: 'Image Classification', description: 'Identify the main object in the camera view (e.g., cat, dog, banana).', color: '#059669', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/></svg>`},
            { id: 'object_detection', name: 'Object Detection', description: 'Find and locate multiple objects like people, cups, or laptops.', color: '#0891b2', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>` },
            { id: 'custom_model',name: 'Custom Vision Model', description: 'Load your own image classification models from Teachable Machine.', color: '#000dffff', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M14 2v2"/><path d="M14 20v2"/></svg>`, boards: ['esp32', 'pico']},
            { id: 'iot_dashboard',name: 'IoT Dashboard',description: 'Visually build a web dashboard to control your project.',color: '#4C51BF', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-9a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M4 17V5a2 2 0 0 1 2-2h11"/></svg>` },
            { id: 'neopixel', name: 'NeoPixel', description: 'Control addressable RGB LED strips like WS2812B.', color: '#F97316', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 5.042A6 6 0 1 0 12 21a6 6 0 0 0 2-11.958Z"/><path d="M12 2v2"/><path d="m4.929 4.929 1.414 1.414"/><path d="M2 12h2"/><path d="m4.929 19.071 1.414-1.414"/><path d="m12 18 v2"/><path d="m19.071 19.071-1.414-1.414"/><path d="M22 12h-2"/><path d="m19.071 4.929-1.414 1.414"/></svg>`, boards: ['esp32', 'pico'] },
            { id: 'display', name: 'OLED Display', description: 'Draw shapes, text, and images on SSD1306 displays.', color: '#6366F1', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M7 8h10M7 12h5M7 16h3"/></svg>`, boards: ['esp32', 'pico'] },
            { id: 'wifi', name: 'Wi-Fi & Web', description: 'Connect to Wi-Fi, make web requests, and create a web server.', color: '#22C55E', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`, boards: ['esp32', 'pico'] },
            { id: 'bluetooth', name: 'Bluetooth LE', description: 'Advertise data using Bluetooth Low Energy.', color: '#3B82F6', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 7 10 10-5 5V2l5 5L7 17"/></svg>`, boards: ['esp32', 'pico'] },
        ];
        
        // --- Manager Instantiation ---
        this.commManager = new CommunicationManager();
        this.aiManager = new AiVisionManager(this.commManager, this); 
        this.deviceFileManager = new DeviceFileManager(this.commManager, this);
        this.dashboardBuilder = new DashboardBuilder(this);
        this.blockGenius = new BlockGenius();
    }

    static async create(boardId, projectName, pythonGenerator) {
        const ide = new ESP32BlockIDE(boardId, projectName, pythonGenerator);
        await ide._initialize();
        return ide;
    }

    setBlocklyManager(manager) {
        this.blocklyManager = manager;
        dialog.setPrompt(showCustomPrompt);
        dialog.setConfirm(showCustomConfirm);
        this.registerBlocklyContextMenu();
        this.setupWorkspaceListeners();
    }

    // --- INITIALIZATION & SETUP ---
    async _initialize() {
        this.initializeUI();
        await this.initializeMonacoEditor();
        this.setupEventListeners();

        this.deviceFileManager.init();
        this.blockGenius.init();
        this.dashboardBuilder.init();
        
        this.setupCommunicationListeners(); 
        this.setupSerialReconnect = () => {
        if (!this.serialComm) return;
        this.serialComm.onReconnect(() => {
        console.log('[IDE LOG] Device reconnected automatically.');
        this.comm = this.serialComm;
        this.setupCommCallbacks();
        this.addConsoleMessage('Device reconnected automatically.', 'success');
        this.updateConnectionStatus('Connected');
        this.ui.connectDropdownBtn.textContent = 'Disconnect';
        this.ui.connectDropdown.classList.add('is-connected');
        this.enableCodeButtons();
        if (this._reconnectPromiseResolver) {
            this._reconnectPromiseResolver();
            this._reconnectPromiseResolver = null;
             }
         });
        };
        this.initializePlotter();
        document.title = `${this.projectName} - ${this.boardId.toUpperCase()} | Block IDE`;
  
       const params = new URLSearchParams(window.location.search);
       const sharedProjectData = params.get('project_data');

       if (sharedProjectData) {
          // If there's shared data, load from URL and skip cache loading
          await this.loadProjectFromURLData(sharedProjectData);
       } else {
           // Normal loading process from IndexedDB
          this.loadExtensionsFromCache();
          this.loadWorkspaceFromCache();
       }

       if (this.blocklyManager?.workspace) {
           this.aiManager.analyzeAiBlockUsage(this.blocklyManager.workspace);
           // This will now trigger the necessary init functions for any AI blocks already in the project.
           this.aiManager.updateAiModelsBasedOnRequirements(); 
       }

       this.updateAiMonitorVisibility();
       this.updateDashboardVisibility();

    }

    initializeUI() {
        this.ui = {
            projectName: document.getElementById('current-project-name'),
            projectTitleWrapper: document.getElementById('project-title-wrapper'),
            renameProjectBtn: document.getElementById('rename-project-btn'),
            headerBoardBadge: document.getElementById('header-board-badge'),
            boardImage: document.getElementById('board-image'),
            blocklyArea: document.getElementById('blocklyArea'),
            uploadBtn: document.getElementById('upload-code'),
            codeView: document.getElementById('code-view'),
            consoleView: document.getElementById('console-view'),
            consoleOutput: document.getElementById('console-output'),
            consoleInput: document.getElementById('console-input'),
            plotterView: document.getElementById('plotter-view'),
            connectUsbBtn: document.getElementById('connect-usb-btn'),
            connectWifiBtn: document.getElementById('connect-wifi-btn'),
            connectDropdownBtn: document.getElementById('connect-dropdown-btn'),
            connectDropdown: document.getElementById('connect-dropdown-btn').closest('.dropdown'),
            webReplModal: document.getElementById('webrepl-modal'),
            webReplIpInput: document.getElementById('webrepl-ip-input'),
            webReplConnectBtn: document.getElementById('webrepl-connect-btn'),
            webReplCancelBtn: document.getElementById('webrepl-cancel-btn'),
            webReplConnectTab: document.getElementById('webrepl-connect-tab'),
            webReplSetupTab: document.getElementById('webrepl-setup-tab'),
            webReplConnectContent: document.getElementById('webrepl-connect-content'),
            webReplSetupContent: document.getElementById('webrepl-setup-content'),
            webReplSetupSsid: document.getElementById('webrepl-setup-ssid'),
            webReplSetupWifiPass: document.getElementById('webrepl-setup-wifi-pass'),
            webReplSetupReplPass: document.getElementById('webrepl-setup-repl-pass'),
            webReplSetupReplPassConfirm: document.getElementById('webrepl-setup-repl-pass-confirm'),
            webReplSetupBtn: document.getElementById('webrepl-setup-btn'),
            webReplSetupCancelBtn: document.getElementById('webrepl-setup-cancel-btn'),
            webReplSetupStatus: document.getElementById('webrepl-setup-status'),

            connectBleBtn: document.getElementById('connect-ble-btn'),
            bleModal: document.getElementById('ble-modal'),
            bleScanBtn: document.getElementById('ble-scan-btn'),
            bleDeviceList: document.getElementById('ble-device-list'),
            bleCancelBtn: document.getElementById('ble-cancel-btn'),
            bleSetupBtn: document.getElementById('ble-setup-btn'),
            bleSetupNameInput: document.getElementById('ble-setup-name'),
            bleSetupStatus: document.getElementById('ble-setup-status'),
            bleSetupCancelBtn: document.getElementById('ble-setup-cancel-btn'),

            copyCodeBtn: document.getElementById('copy-code-btn'),
            uploadModal: document.getElementById('upload-status-modal'),
            uploadModalIcon: document.getElementById('upload-status-icon'),
            uploadModalMessage: document.getElementById('upload-status-message'),
            blocksViewBtn: document.getElementById('blocks-view-btn'),
            codeViewBtn: document.getElementById('code-view-btn'),
            consoleBtn: document.getElementById('console-btn'),
            plotterBtn: document.getElementById('plotter-btn'),
            extensionModal: document.getElementById('extension-modal'),
            extensionList: document.getElementById('extension-list'),
            extensionModalCloseBtn: document.getElementById('extension-modal-close-btn'),
            sidebarWebcam: document.getElementById('sidebar-webcam'),
            boardViewerContainer: document.getElementById('board-viewer-container'),
            toggleCamBtn: document.getElementById('toggle-cam-btn'),
            sidebarCanvas: document.getElementById('sidebar-canvas-overlay'),
            aiMonitorModal: document.getElementById('ai-monitor-modal'),
            aiMonitorHeader: document.getElementById('ai-monitor-header'),
            aiMonitorCloseBtn: document.getElementById('ai-monitor-close-btn'),
            aiMonitorCanvas: document.getElementById('ai-monitor-canvas'),
            aiMonitorDataOutput: document.getElementById('ai-monitor-data-output'),
            aiMonitorToggles: document.querySelectorAll('.ai-monitor-toggle'),
            aiMonitorBtn: document.getElementById('ai-monitor-btn'),
            liveModeBtn: document.getElementById('live-mode-btn'),
            geniusToast: document.getElementById('block-genius-toast'),
            geniusTitle: document.getElementById('genius-title'),
            geniusDescription: document.getElementById('genius-description'),
            geniusImage: document.getElementById('genius-image'),
            geniusCloseBtn: document.getElementById('genius-close-btn'),
            startTutorialBtn: document.getElementById('start-tutorial-btn'),
            shareProjectBtn: document.getElementById('share-project-btn'),
            tutorialModal: document.getElementById('tutorial-modal'),
            tutorialList: document.getElementById('tutorial-list'),
            tutorialModalCloseBtn: document.getElementById('tutorial-modal-close-btn'),

            newFileModal: document.getElementById('new-file-modal'),
            newFileNameInput: document.getElementById('new-file-name-input'),
            newFileCreateBtn: document.getElementById('new-file-create-btn'),
            newFileCancelBtn: document.getElementById('new-file-cancel-btn'),

            deviceFilesBtn: document.getElementById('device-files-btn'),
            fileManagerModal: document.getElementById('file-manager-modal'),
            fileManagerCloseBtn: document.getElementById('file-manager-close-btn'),
            fileManagerRefreshBtn: document.getElementById('file-manager-refresh-btn'),
            fileManagerUploadBtn: document.getElementById('file-manager-upload-btn'),
            fileManagerUploadInput: document.getElementById('file-manager-upload-input'),
            fileListContainer: document.getElementById('file-list-container'),
            exportProjectBtn: document.getElementById('export-project-btn'),
            saveToDeviceBtn: document.getElementById('save-to-device-btn'),
            deviceInfoBtn: document.getElementById('device-info-btn'),
            deviceInfoModal: document.getElementById('device-info-modal'),
            deviceInfoCloseBtn: document.getElementById('device-info-close-btn'),
            deviceInfoContent: document.getElementById('device-info-content'),
            libraryManagerBtn: document.getElementById('library-manager-btn'),
            libraryManagerModal: document.getElementById('library-manager-modal'),
            libraryManagerCloseBtn: document.getElementById('library-manager-close-btn'),
            libraryListContainer: document.getElementById('library-list-container'),
            cleanUploadBtn: document.getElementById('clean-upload-btn'),
            dashboardBtn: document.getElementById('dashboard-btn'),
            iotDashboardModal: document.getElementById('iot-dashboard-modal'),
            dashboardCloseBtn: document.getElementById('dashboard-close-btn'),
            dashboardCanvas: document.getElementById('dashboard-canvas'),
            dashboardClearBtn: document.getElementById('dashboard-clear-btn'),
            dashboardExportBtn: document.getElementById('dashboard-export-btn'),
            dashboardUpdateBtn: document.getElementById('update-properties'),
            dashboardDeleteBtn: document.getElementById('delete-component'),
            dashboardViewToggles: document.querySelectorAll('.view-toggle button'),
            propertiesContent: document.getElementById('properties-content'),
            noSelectionPrompt: document.getElementById('no-selection-prompt'),
            leftSidebar: document.querySelector('.left-sidebar'),
            exportModal: document.getElementById('export-modal'),
            modalCloseBtn: document.getElementById('modal-close-btn'),
            copyHtmlBtn: document.getElementById('copy-html-btn'),
            copyMicroPythonBtn: document.getElementById('copy-micropython-btn'),

            sidebarBoardView: document.getElementById('sidebar-board-view'),
            sidebarFileView: document.getElementById('sidebar-file-view'),
            customModelToggle: document.querySelector('.ai-monitor-toggle[data-model="custom"]'),

        };
        this.ui.projectName.textContent = this.projectName;
        this.ui.boardImage.src = this.boardImageMap[this.boardId] || this.boardImageMap['esp32'];
        this.ui.boardImage.alt = this.boardNameMap[this.boardId] || 'Microcontroller';
        this.ui.liveModeBtn.disabled = true;
        const boardName = this.boardNameMap[this.boardId] || 'Device';
        const uploadBtnText = this.ui.uploadBtn.querySelector('span');
        if (uploadBtnText) uploadBtnText.textContent = `Upload to ${boardName}`;
        if (this.ui.headerBoardBadge) this.ui.headerBoardBadge.textContent = boardName;
        if (this.boardId === 'esp32') {this.ui.connectBleBtn.style.display = 'block';}
        this.updateConnectionStatus('Disconnected');
        this.disableCodeButtons();
        this.updateAiMonitorVisibility();
        this.updateDashboardVisibility();
    }
        
    updateEditorTheme() {
        if (!this.monacoEditor) return;

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        switch (currentTheme) {
            case 'dark':
                monaco.editor.setTheme('vs-dark');
                break;
            case 'contrast':
                monaco.editor.setTheme('hc-black'); 
                break;
            case 'light':
            default:
                monaco.editor.setTheme('vs');
                break;
        }
    }

    async initializeMonacoEditor() {
        this.monacoEditor = monaco.editor.create(document.getElementById('monaco-editor-container'), {
            value: '# Connect to a device and start coding!',
            language: 'python',
            readOnly: false,
            fontFamily: 'Fira Code, monospace',
            fontSize: 15,
            lineHeight: 28,
            automaticLayout: true,
            minimap: { enabled: false },
            wordWrap: 'on',
            renderLineHighlight: 'all',
            scrollbar: {
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10
            }
        });
    
        this.monacoEditor.onDidChangeModelContent(() => {
            this.currentCode = this.monacoEditor.getValue();
        });
        this.updateEditorTheme();
    }
    
    initializePlotter() {
        const ctx = document.getElementById('plotter-canvas').getContext('2d');
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const fontColor = theme === 'dark' ? '#A0AEC0' : '#718096';
    
        this.plotterChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [], 
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: fontColor }, grid: { color: gridColor } },
                    y: { ticks: { color: fontColor }, grid: { color: gridColor } }
                },
                plugins: { 
                    legend: { 
                        display: true,
                        position: 'top',
                        labels: {
                            color: fontColor
                        }
                    } 
                }
            }
        });
    }

    setupEventListeners() {
        // --- Main Navigation & Project Actions ---
        document.getElementById('back-to-projects-btn').addEventListener('click', () => {
            this.aiManager.stopAiVision();
            this.saveWorkspaceToCache();
            window.location.href = 'index.html';
        });
        this.ui.renameProjectBtn.addEventListener('click', () => this.handleProjectRename());
        this.ui.shareProjectBtn.addEventListener('click', () => this.handleProjectShare());
        this.ui.startTutorialBtn.addEventListener('click', () => this.openTutorialModal());
        this.ui.tutorialModalCloseBtn.addEventListener('click', () => { this.ui.tutorialModal.style.display = 'none'; });

        // --- Main View Toggles ---
        this.ui.blocksViewBtn.addEventListener('click', () => this.switchView('blocks'));
        this.ui.codeViewBtn.addEventListener('click', () => { this.switchView('code'); this.openFile('main.py'); });
        this.ui.uploadBtn.addEventListener('click', () => this.uploadCodeToDevice());
        this.ui.consoleBtn.addEventListener('click', () => this.switchView('console'));
        this.ui.plotterBtn.addEventListener('click', () => this.switchView('plotter'));
        
        // --- File Management Triggers ---
        this.ui.deviceFilesBtn.addEventListener('click', () => this.deviceFileManager.open());
        document.getElementById('new-file-btn').addEventListener('click', () => this.openNewFileModal());

// --- File Management Triggers ---
this.ui.deviceFilesBtn.addEventListener('click', () => this.deviceFileManager.open());
document.getElementById('new-file-btn').addEventListener('click', () => this.openNewFileModal());

// --- New File Modal Listeners ---
this.ui.newFileCancelBtn.addEventListener('click', () => this.closeNewFileModal());
this.ui.newFileCreateBtn.addEventListener('click', () => this.handleCreateNewFile());
this.ui.newFileNameInput.addEventListener('input', () => {
    const hasText = this.ui.newFileNameInput.value.trim().length > 0;
    this.ui.newFileCreateBtn.disabled = !hasText;
});
this.ui.newFileNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !this.ui.newFileCreateBtn.disabled) this.handleCreateNewFile();
});

        // Main Dropdown Button (Disconnect Action)
        this.ui.connectDropdownBtn.addEventListener('click', () => {
            if (this.commManager.isConnected()) {
                this.commManager.disconnect();
            }
        });

        // USB Connect Option
        this.ui.connectUsbBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.commManager.connectUSB(); // DELEGATED
        });

        // Wi-Fi Connect Option
        this.ui.connectWifiBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.ui.webReplModal.style.display = 'flex';
            this.ui.webReplConnectTab.click();
            this.ui.webReplIpInput.focus();
        });

        // BLE Connect Option
        this.ui.connectBleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.ui.bleModal.style.display = 'flex';
            document.getElementById('ble-connect-tab').click();
        });
    
    this.ui.webReplCancelBtn.addEventListener('click', () => { this.ui.webReplModal.style.display = 'none'; });
    
    this.ui.webReplSetupCancelBtn.addEventListener('click', () => { this.ui.webReplModal.style.display = 'none'; });
    
    this.ui.webReplConnectTab.addEventListener('click', () => {
        this.ui.webReplConnectTab.classList.add('active');
        this.ui.webReplSetupTab.classList.remove('active');
        this.ui.webReplConnectContent.classList.add('active');
        this.ui.webReplSetupContent.classList.remove('active');
    });
    
    this.ui.webReplSetupTab.addEventListener('click', () => {
        this.ui.webReplSetupTab.classList.add('active');
        this.ui.webReplConnectTab.classList.remove('active');
        this.ui.webReplSetupContent.classList.add('active');
        this.ui.webReplConnectContent.classList.remove('active');
    });
    
    this.ui.webReplSetupBtn.addEventListener('click', async () => {
        const statusEl = this.ui.webReplSetupStatus;
        const setStatus = (msg, type = 'info') => {
            statusEl.textContent = msg;
            statusEl.className = `setup-status ${type}`;
            statusEl.style.display = 'block';
        };
    
        // 1. Validate inputs
        const ssid = this.ui.webReplSetupSsid.value.trim();
        const wifiPass = this.ui.webReplSetupWifiPass.value;
        const replPass = this.ui.webReplSetupReplPass.value;
        const replPassConfirm = this.ui.webReplSetupReplPassConfirm.value;
    
        if (!ssid || !replPass) {
            return setStatus('Wi-Fi SSID and WebREPL Password are required.', 'error');
        }
        if (replPass !== replPassConfirm) {
            return setStatus('WebREPL passwords do not match.', 'error');
        }
        if (!this.comm || !this.comm.isConnected || this.comm !== this.serialComm) {
            return setStatus('A USB connection is required for the initial setup.', 'error');
        }
        
        this.ui.webReplSetupBtn.disabled = true;
        
    try {
        console.log('[SETUP LOG] Start button clicked. Validation passed.');
    
        // 1. Prepare, generate, and upload files
        setStatus('Preparing and uploading files...');
        await this._deleteDeviceFile('main.py');
        const webreplCfgContent = `PASS = '${replPass}'\\n`;
        const bootScriptContent = `# boot.py - Robust "Announcer" Script
    import network, time, webrepl, sys
    WIFI_SSID = "${ssid}"
    WIFI_PASSWORD = "${wifiPass}"
    print("--- Running boot.py ---")
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)
    max_wait = 20
    while max_wait > 0:
        if wlan.isconnected(): break
        print("STATUS:CONNECTING")
        sys.stdout.flush()
        max_wait -= 1; time.sleep(1)
    if wlan.isconnected():
        ip_address = wlan.ifconfig()[0]
        for _ in range(10): print(f"STATUS:SUCCESS:{ip_address}"); sys.stdout.flush(); time.sleep(1)
        webrepl.start()
    else:
        for _ in range(10): print("STATUS:FAILED:Wi-Fi connection failed."); sys.stdout.flush(); time.sleep(1)
    print("--- boot.py finished ---")`;
        await this._uploadFileInChunks('webrepl_cfg.py', webreplCfgContent);
        await this._uploadFileInChunks('boot.py', bootScriptContent);
    
        // 2. Reboot the device
        setStatus('Upload complete. Rebooting device...');
        await this.comm.sendData('\\x04');
        // We expect the disconnect, but we will handle the reconnect manually.
        this.serialComm.stopAutoReconnect(); // Stop any background timers.
        this.handleDisconnect();
        
        // --- 3. PROACTIVE POLLING AND LISTENING LOOP ---
        setStatus('Waiting for device to reconnect...');
        console.log('[SETUP LOG] Starting proactive polling and listening loop...');
    
        const findAndListenForIP = async (timeout = 30000) => {
            const startTime = Date.now();
            let port;
    
            // Part A: Find and open the port
            while (Date.now() - startTime < timeout) {
                const availablePorts = await navigator.serial.getPorts();
                port = availablePorts.find(p => {
                    const info = p.getInfo();
                    return info.usbVendorId === this.serialComm.deviceInfo.usbVendorId &&
                           info.usbProductId === this.serialComm.deviceInfo.usbProductId;
                });
    
                if (port) {
                    try {
                        console.log('[SETUP LOG] Port found. Attempting to open...');
                        await port.open({ baudRate: 115200 });
                        console.log('[SETUP LOG] Port opened successfully.');
                        break; // Exit the finding loop
                    } catch (e) {
                        // Port might still be busy, wait and try again
                        console.warn(`[SETUP LOG] Port found but failed to open: ${e.message}. Retrying...`);
                        port = null; // Reset port variable
                    }
                }
                await new Promise(r => setTimeout(r, 1000));
            }
    
            if (!port || !port.readable) {
                throw new Error("Device did not reconnect or port could not be opened.");
            }
    
            // Part B: Proactively listen on the newly opened port
            setStatus('Device reconnected. Listening for IP address...');
            const reader = port.readable.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
    
            try {
                while (Date.now() - startTime < timeout) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    console.log(`[SETUP LOG] Raw data received: "${buffer.trim()}"`);
                    
                    if (buffer.includes("STATUS:")) {
                         if (buffer.includes("SUCCESS")) {
                            const ipMatch = buffer.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
                            if (ipMatch && ipMatch[1]) return { ip: ipMatch[1], port: port };
                         }
                         if (buffer.includes("FAILED")) {
                            throw new Error("Wi-Fi connection failed. Please check credentials.");
                         }
                    }
                }
                throw new Error("Timeout: Device did not report its status.");
            } finally {
                reader.releaseLock();
            }
        };
    
        const { ip, port } = await findAndListenForIP();
    
        // 4. Finalize the connection in the main IDE
        console.log('[SETUP LOG] Handshake complete. Finalizing IDE connection state.');
        this.serialComm.port = port;
        this.serialComm.isConnected = true;
        this.serialComm.writer = port.writable.getWriter();
        this.comm = this.serialComm;
        this.setupCommCallbacks(); // Now we set the main callback
        this.serialComm.startReadLoop(); // And start the main loop
        this.updateConnectionStatus('Connected');
        this.enableCodeButtons();
        port.addEventListener('disconnect', () => this.serialComm.handleDisconnect());
    
        // 5. Success
        setStatus(`Success! Device IP is ${ip}`, 'success');
        this.ui.webReplIpInput.value = ip;
        this.ui.webReplConnectTab.click();
    
    } catch (error) {
        console.error(`[SETUP LOG] ERROR caught: ${error.message}`);
        setStatus(`Setup Failed: ${error.message}`, 'error');
    } finally {
        // ALWAYS clean up state flags.
        this.serialComm.isRebooting = false; // Allow normal auto-reconnect to work again
        this.ui.webReplSetupBtn.disabled = false;
        console.log('[SETUP LOG] Setup process finished (in finally block).');
    }
    });
    
    
    this.ui.webReplConnectBtn.addEventListener('click', () => { // No longer needs to be async
        const ip = this.ui.webReplIpInput.value.trim();
        if (!ip) {
            alert('Please enter an IP address.');
            return;
        }

        this.ui.webReplModal.style.display = 'none';

        // Delegate the entire connection process to the manager.
        // The manager will emit events, and our new listener will handle all UI updates.
        this.commManager.connectWebREPL(ip); 
    });
    
    
    // --- BLE Modal Listeners ---
    this.ui.connectBleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.ui.bleModal.style.display = 'flex';
        // Logic to switch between tabs
        const connectTab = document.getElementById('ble-connect-tab');
        const setupTab = document.getElementById('ble-setup-tab');
        const connectContent = document.getElementById('ble-connect-content');
        const setupContent = document.getElementById('ble-setup-content');
        
        connectTab.onclick = () => {
            connectTab.classList.add('active');
            setupTab.classList.remove('active');
            connectContent.classList.add('active');
            setupContent.classList.remove('active');
        };
        setupTab.onclick = () => {
            setupTab.classList.add('active');
            connectTab.classList.remove('active');
            setupContent.classList.add('active');
            connectContent.classList.remove('active');
        };
        connectTab.click(); // Start on the connect tab
    });
    
    this.ui.bleCancelBtn.addEventListener('click', () => { this.ui.bleModal.style.display = 'none'; });
    this.ui.bleSetupCancelBtn.addEventListener('click', () => { this.ui.bleModal.style.display = 'none'; });
    
    // Scan button logic
    this.ui.bleScanBtn.addEventListener('click', async () => {
        this.ui.bleDeviceList.innerHTML = '<p style="padding: 1rem;">Scanning...</p>';
        try {
            const device = await this.bleComm.scan();
            this.ui.bleDeviceList.innerHTML = ''; // Clear scanning message
            
            const deviceItem = document.createElement('div');
            deviceItem.textContent = `Found: ${device.name || `ID: ${device.id}`}`;
            deviceItem.style.padding = '1rem';
            deviceItem.style.cursor = 'pointer';
            deviceItem.onclick = async () => {
                this.ui.bleModal.style.display = 'none';
                this.updateConnectionStatus('Connecting');
                try {
                    await this.bleComm.connect(device);
                    this.comm = this.bleComm; // Set the active communicator
                    this.connectionType = 'ble';
                    this.setupCommCallbacks();
                    this.addConsoleMessage(`Device connected via Bluetooth.`, 'success');
                    this.updateConnectionStatus('Connected');
                    this.enableCodeButtons();
                    this.ui.connectDropdownBtn.textContent = 'Disconnect';
                    this.ui.connectDropdown.classList.add('is-connected');
                } catch (connectError) {
                    this.addConsoleMessage(`Bluetooth Connection failed: ${connectError.message}`, 'error');
                    this.updateConnectionStatus('Disconnected');
                }
            };
            this.ui.bleDeviceList.appendChild(deviceItem);
    
        } catch (error) {
            this.ui.bleDeviceList.innerHTML = `<p style="padding: 1rem; color: var(--accent-error);">Error: ${error.message}</p>`;
        }
    });
    
    // Setup button logic
    this.ui.bleSetupBtn.addEventListener('click', async () => {
        const statusEl = this.ui.bleSetupStatus;
        const setStatus = (msg, type = 'info') => {
            statusEl.textContent = msg;
            statusEl.className = `setup-status ${type}`;
            statusEl.style.display = 'block';
        };
    
        if (!this.comm || !this.comm.isConnected || this.comm !== this.serialComm) {
            return setStatus('A USB connection is required for the initial setup.', 'error');
        }
        
        const bleName = this.ui.bleSetupNameInput.value.trim();
        if (!bleName) {
            return setStatus('Please provide a Bluetooth device name.', 'error');
        }
    
        this.ui.bleSetupBtn.disabled = true;
    
        try {
            // --- STEP 1: UPLOAD SCRIPT (Same as before) ---
            setStatus('Preparing BLE REPL script...');
            const bleScript = getBleReplScript(bleName);
            
            setStatus('Uploading script to boot.py...');
            await this._uploadFileInChunks('boot.py', bleScript);
            
            setStatus('Upload complete. Rebooting device...');
            await this.comm.sendData('\\x04'); // Soft reboot
            
            // --- STEP 2: AUTOMATIC DISCONNECT & RECONNECT (NEW LOGIC) ---
            setStatus('Device is rebooting. Disconnecting from USB...');
            
            // Give the reboot command a moment to be sent before disconnecting
            await new Promise(r => setTimeout(r, 500));
            
            // Disconnect from USB. We call the main handler directly.
            await this.manualDisconnect();
            
            // Switch to the connect tab
            document.getElementById('ble-connect-tab').click();
            
            // Inform the user and automatically trigger the scan
            this.ui.bleDeviceList.innerHTML = `<p style="padding: 1rem;">Setup complete! Waiting for you to select '${bleName}' from the Bluetooth device list...</p>`;
            
            // Give the device a few seconds to reboot and start advertising
            await new Promise(r => setTimeout(r, 3000)); 
            
            // Automatically click the scan button's logic for the user
            this.ui.bleScanBtn.click();
    
        } catch (error) {
            setStatus(`Setup failed: ${error.message}`, 'error');
            // Re-enable the button on failure
            this.ui.bleSetupBtn.disabled = false;
        } 
        // The button remains disabled on success, as the modal should be closed by the connection flow.
    });
    
    function getBleReplScript(deviceName) {
        return `
    # boot.py - BLE WebREPL
    import ubluetooth
    import os
    import time
    
    _UART_UUID = ubluetooth.UUID('6E400001-B5A3-F393-E0A9-E50E24DCCA9E')
    _TX_CHAR_UUID = ubluetooth.UUID('6E400003-B5A3-F393-E0A9-E50E24DCCA9E')
    _RX_CHAR_UUID = ubluetooth.UUID('6E400002-B5A3-F393-E0A9-E50E24DCCA9E')
    
    _UART_SERVICE = (
        _UART_UUID,
        (
            (_TX_CHAR_UUID, ubluetooth.FLAG_READ | ubluetooth.FLAG_NOTIFY,),
            (_RX_CHAR_UUID, ubluetooth.FLAG_WRITE | ubluetooth.FLAG_WRITE_NO_RESPONSE,),
        ),
    )
    
    class BLEUART:
        def __init__(self, ble, name="${deviceName}", rxbuf=100):
            self._ble = ble
            self._ble.active(True)
            self._ble.irq(self._irq)
            ((self._tx_handle, self._rx_handle),) = self._ble.gatts_register_services((_UART_SERVICE,))
            self._connections = set()
            self._rx_buffer = bytearray()
            self._handler = None
            self._payload = ubluetooth.advertise_description(name=name, services=[_UART_UUID])
            self._advertise()
            os.dupterm(self)
    
        def _irq(self, event, data):
            if event == 1: # _IRQ_CENTRAL_CONNECT
                conn_handle, _, _ = data
                self._connections.add(conn_handle)
                console.log("BLE Central connected")
            elif event == 2: # _IRQ_CENTRAL_DISCONNECT
                conn_handle, _, _ = data
                if conn_handle in self._connections:
                    self._connections.remove(conn_handle)
                console.log("BLE Central disconnected")
                self._advertise()
            elif event == 3: # _IRQ_GATTS_WRITE
                conn_handle, value_handle = data
                if conn_handle in self._connections and value_handle == self._rx_handle:
                    self._rx_buffer += self._ble.gatts_read(self._rx_handle)
    
        def read(self, sz=None):
            if not self._rx_buffer:
                return None
            if sz is None:
                sz = len(self._rx_buffer)
            result = self._rx_buffer[0:sz]
            self._rx_buffer = self._rx_buffer[sz:]
            return result
    
        def write(self, data):
            for conn_handle in self._connections:
                self._ble.gatts_notify(conn_handle, self._tx_handle, data)
    
        def _advertise(self, interval_us=500000):
            self._ble.gap_advertise(interval_us, adv_data=self._payload)
    
    console.log("Starting BLE WebREPL...")
    ble = ubluetooth.BLE()
    uart = BLEUART(ble)
    `;
    }
    
       
        // Console Listeners
        document.getElementById('clear-console-btn').addEventListener('click', () => {
            this.ui.consoleOutput.innerHTML = '';
            this.consoleBuffer = [];
            this.addConsoleMessage('Console cleared.', 'info');
        });
        this.ui.consoleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendConsoleCommand(e.target.value + '\r\n');
                e.target.value = '';
            }
        });
    
        window.addEventListener('codeUpdated', (event) => {
        this.codeWithBlockIds = event.detail;
        this.currentCode = this.codeWithBlockIds.replace(/^\s*# block_id=.*\n/gm, '');
        
        if (this.monacoEditor) {
            this.monacoEditor.setValue(this.currentCode);
        }
        
        this.updateUI();
        });
    
    
        // Other UI Listeners
        this.ui.liveModeBtn.addEventListener('click', () => this.handleLiveModeToggle());
        this.ui.geniusCloseBtn.addEventListener('click', () => this.hideBlockGenius());
        
        this.ui.extensionModalCloseBtn.addEventListener('click', () => { this.ui.extensionModal.style.display = 'none'; });
    
        this.ui.cleanUploadBtn.addEventListener('click', () => this.cleanAndUpload());
        
// File Manager Modal Listeners
this.ui.fileManagerCloseBtn.addEventListener('click', () => this.deviceFileManager.close());
this.ui.fileManagerRefreshBtn.addEventListener('click', () => this.deviceFileManager.fetchAndRenderFileList());
this.ui.fileManagerUploadBtn.addEventListener('click', () => this.ui.fileManagerUploadInput.click());
this.ui.fileManagerUploadInput.addEventListener('change', (e) => this.deviceFileManager.uploadSelectedFileToDevice(e.target.files[0]));

// New Buttons inside the File Manager Modal
this.ui.exportProjectBtn.addEventListener('click', () => this.exportProject()); // This one is correct, it's on the IDE class
this.ui.saveToDeviceBtn.addEventListener('click', () => this.deviceFileManager.saveCodeToDevice());
this.ui.cleanUploadBtn.addEventListener('click', () => this.deviceFileManager.cleanAndUpload());

// Device info
this.ui.deviceInfoBtn.addEventListener('click', () => this.deviceFileManager.showDeviceInfo());
this.ui.deviceInfoCloseBtn.addEventListener('click', () => { this.ui.deviceInfoModal.style.display = 'none'; });

//library manager
this.ui.libraryManagerBtn.addEventListener('click', () => this.deviceFileManager.showLibraryManager());
this.ui.libraryManagerCloseBtn.addEventListener('click', () => { this.ui.libraryManagerModal.style.display = 'none'; });
    
        // Dashboard Listeners
        this.ui.dashboardBtn.addEventListener('click', () => this.dashboardBuilder.show());
        this.ui.dashboardCloseBtn.addEventListener('click', () => { this.ui.iotDashboardModal.style.display = 'none'; });
    
        window.addEventListener('beforeunload', () => {
                // This ensures the very latest state is saved if the user refreshes.
                this.saveWorkspaceToCache();
            });
    
    }

    handleErrorHighlighting(lineNumber) {
        if (!this.currentCode || !this.blocklyManager) return; // **MODIFIED**

        console.log(`Error on line ${lineNumber}. Searching for block...`);
        const codeLines = this.codeWithBlockIds.split('\n');
        let blockId = null;

        for (let i = lineNumber - 1; i >= 0; i--) {
            const line = codeLines[i];
            const match = line.match(/^\s*# block_id=([a-zA-Z0-9\-_!@#$%^&*()_=+.,'":;?/~`|{}[\]]+)/);
            if (match && match[1]) {
                blockId = match[1];
                break;
            }
        }

        if (blockId) {
            this.addConsoleMessage(`Highlighting block corresponding to line ${lineNumber}.`, 'info');
            const workspace = this.blocklyManager.workspace; // **MODIFIED**
            this.switchView('blocks');
            workspace.highlightBlock(blockId);
        } else {
            console.log(`No block ID found for line ${lineNumber}.`);
        }
    }

    // ... (rest of file from addPlotterData at line 1084 to saveWorkspaceToCache at line 1374 is unchanged) ...
    addPlotterData(line) {
    if (!this.plotterChart) return;

    const parts = line.split(':');
    if (parts.length < 4 || parts[0] !== 'plot') return;

    const name = parts[1].replace(/"/g, '');
    const color = parts[2];
    const value = parseFloat(parts[3]);

    if (isNaN(value)) return;

    let dataset = this.plotterChart.data.datasets.find(ds => ds.label === name);

    // If this data series is new, create it
    if (!dataset) {
        dataset = {
            label: name,
            data: new Array(this.plotterDataPointCount).fill(null), // Pad with nulls for previous data points
            borderColor: color,
            backgroundColor: `${color}33`,
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.3,
            fill: true
        };
        this.plotterChart.data.datasets.push(dataset);
    } else {
        if (dataset.borderColor !== color) {
            dataset.borderColor = color;
            dataset.backgroundColor = `${color}33`;
        }
    }
    this.plotterChart.data.labels.push(this.plotterDataPointCount++);
    this.plotterChart.data.datasets.forEach(ds => {
        if (ds.label === name) {
            ds.data.push(value);
        } else {
            ds.data.push(null); 
        }
    });
    if (this.plotterChart.data.labels.length > this.MAX_PLOTTER_POINTS) {
        this.plotterChart.data.labels.shift();
        this.plotterChart.data.datasets.forEach(ds => {
            ds.data.shift();
        });
    }

    this.plotterChart.update('none');
    }

    openNewFileModal() {
    this.ui.newFileNameInput.value = '';
    this.ui.newFileCreateBtn.disabled = true;
    this.ui.newFileModal.style.display = 'flex';
    this.ui.newFileNameInput.focus();
     }

    closeNewFileModal() {
    this.ui.newFileModal.style.display = 'none';
    }    

setupWorkspaceListeners() {
        if (!this.blocklyManager?.workspace) return;
        this.aiManager.updateAiStateFromBlocks();

        const workspace = this.blocklyManager.workspace;
        workspace.addChangeListener((event) => {
            if (event.isUiEvent || event.type === Blockly.Events.FINISHED_LOADING) return;

            if (event.type === Blockly.Events.BLOCK_CREATE) {
                const block = workspace.getBlockById(event.blockId);
                if (block) {
                    this.blockGenius.handleBlockCreate(block.type);
                }
            }
            this.aiManager.updateAiStateFromBlocks();
            
            clearTimeout(this.workspaceUpdateTimeout);
            this.workspaceUpdateTimeout = setTimeout(() => {
                if (this.blocklyManager) {
                    this.blocklyManager.generateCode();
                }
                this.saveWorkspaceToCache();
            }, this.WORKSPACE_UPDATE_DEBOUNCE_MS);
        });
    }


    setupCommunicationListeners() {
        this.commManager.on('status', (status) => {
            this.updateConnectionStatus(status);
            this.ui.connectDropdownBtn.textContent = 'Connecting...';
            this.ui.connectDropdownBtn.disabled = true;
        });

        this.commManager.on('connected', (detail) => {
            this.comm = this.commManager.getActiveComm();

            this.addConsoleMessage(detail.message, 'success');
            this.updateConnectionStatus('Connected');
            this.enableCodeButtons(); // This will now work correctly!
            this.ui.connectDropdownBtn.textContent = 'Disconnect';
            this.ui.connectDropdown.classList.add('is-connected');
            this.ui.connectDropdownBtn.disabled = false;
        });
        
        this.commManager.on('disconnected', (detail) => {
            this.comm = null;

            if (detail.message) {
                this.addConsoleMessage(detail.message, 'info');
            }
            this.updateConnectionStatus('Disconnected');
            this.disableCodeButtons(); // This will now work correctly!
            this.ui.connectDropdownBtn.textContent = 'Connect';
            this.ui.connectDropdown.classList.remove('is-connected');
            this.ui.connectDropdownBtn.disabled = false;
            
            this.isLiveMode = false;
            this.ui.liveModeBtn.classList.remove('active');
            this.ui.liveModeBtn.disabled = true;
            this.aiManager.stopAiVision();
            
            if (this.isCodeOnlyMode) {
                this.openFile('main.py');
                this.switchView('blocks');
            }
        });

        this.commManager.on('error', (message) => {
            this.addConsoleMessage(message, 'error');
        });

        this.commManager.on('data', (data) => {
            this.handleData(data);
        });
    }
    
    // --- CORE IDE & UI MANAGEMENT ---

    async switchView(viewName) {
        // Deactivate all view-switching buttons
        this.ui.blocksViewBtn.classList.remove('active');
        this.ui.codeViewBtn.classList.remove('active');
        this.ui.consoleBtn.classList.remove('active');
        this.ui.plotterBtn.classList.remove('active');

        // Hide all main content panels
        this.ui.blocklyArea.style.display = 'none';
        document.getElementById('monaco-editor-container').style.display = 'none';
        this.ui.consoleView.classList.remove('active');
        this.ui.plotterView.classList.remove('active');

        // Get references to the sidebar panels
        const boardViewSidebar = document.getElementById('sidebar-board-view');
        const fileViewSidebar = document.getElementById('sidebar-file-view');

        if (viewName === 'blocks') {
            this.ui.blocksViewBtn.classList.add('active');
            this.ui.blocklyArea.style.display = 'block';

            // Show Board Viewer, Hide File Explorer
            boardViewSidebar.classList.add('active');
            fileViewSidebar.classList.remove('active');

            // This ensures blockly resizes correctly after being hidden
            setTimeout(() => window.dispatchEvent(new Event('resize')), 50);

        } else if (viewName === 'code') {
            this.ui.codeViewBtn.classList.add('active');
            document.getElementById('monaco-editor-container').style.display = 'block';
        
            // Show File Explorer, Hide Board Viewer
            fileViewSidebar.classList.add('active');
            boardViewSidebar.classList.remove('active');

        } else if (viewName === 'console') {
            this.ui.consoleBtn.classList.add('active');
            this.ui.consoleView.classList.add('active');
    
        } else if (viewName === 'plotter') {
            this.ui.plotterBtn.classList.add('active');
            this.ui.plotterView.classList.add('active');
        }
    }

    updateUIAfterModelLoad() {
        this.updateAiMonitorVisibility(); // Update the main header button
        this.refreshCustomModelBlock();   // Refresh the block on the workspace
        this.updateToolboxWithCustomClasses(); // Refresh the toolbox dropdowns
    }

    refreshCustomModelBlock() {
        if (!this.blocklyManager || !this.blocklyManager.workspace) return;
        const setupBlock = this.blocklyManager.workspace.getBlocksByType('custom_model_setup', false)[0];
        if (setupBlock) {
            setupBlock.render();
        }
    }

    updateAiMonitorVisibility() {
        const aiExtensionIds = ['face_landmark', 'hand_gesture', 'image_classification', 'object_detection'];
        const hasStandardAiExtension = aiExtensionIds.some(id => this.loadedExtensions.has(id));
        const hasLoadedCustomModel = this.loadedExtensions.has('custom_model') && this.aiManager.isModelSuccessfullyLoaded;

        this.ui.aiMonitorBtn.style.display = (hasStandardAiExtension || hasLoadedCustomModel) ? 'flex' : 'none';
    }

    updateDashboardVisibility() {
        const hasDashboard = this.loadedExtensions.has('iot_dashboard');
        this.ui.dashboardBtn.style.display = hasDashboard ? 'flex' : 'none';
    }

    
    updateUI() {
        const hasCode = this.currentCode.trim().length > 0;
        const isConnected = this.comm?.isConnected || false;

        if (this.ui.uploadBtn) {
            this.ui.uploadBtn.disabled = !(hasCode && isConnected);
        }
        if (this.ui.deviceFilesBtn) {
            this.ui.deviceFilesBtn.disabled = !isConnected;
        }
        if (this.ui.exportProjectBtn) {
            this.ui.exportProjectBtn.disabled = !hasCode;
        }
        if (this.ui.saveToDeviceBtn) {
            this.ui.saveToDeviceBtn.disabled = !(hasCode && isConnected);
        }
        if (this.ui.liveModeBtn) {
            this.ui.liveModeBtn.disabled = !isConnected;
        }
        if(this.ui.cleanUploadBtn) {
            this.ui.cleanUploadBtn.disabled = !isConnected;
        }
        if(this.ui.deviceInfoBtn) {
            this.ui.deviceInfoBtn.disabled = !isConnected;
        }
        if(this.ui.libraryManagerBtn) {
            this.ui.libraryManagerBtn.disabled = !isConnected;
        }
    }

    enableCodeButtons() {
        this.updateUI();
    }

    disableCodeButtons() {
        this.updateUI();
    }

    updateConnectionStatus(status) {
        const wrapper = document.getElementById('connection-status-wrapper');
        if (wrapper) { wrapper.querySelector('span').textContent = status; wrapper.className = `connection-status-wrapper connection-${status.toLowerCase().replace(/ /g, '-')}`; }
    }
    
    addConsoleMessage(message, type = 'output') {
        const lines = message.replace(/\r/g, '').split('\n').filter(l => l.length > 0);
        for (const l of lines) this.consoleBuffer.push({ text: l, type });
        if (!this.isConsoleUpdateScheduled) {
            this.isConsoleUpdateScheduled = true;
            setTimeout(() => this.flushConsoleBuffer(), this.CONSOLE_UPDATE_INTERVAL);
        }
    }

    flushConsoleBuffer() {
        if (this.consoleBuffer.length === 0) { this.isConsoleUpdateScheduled = false; return; }
        const out = this.ui.consoleOutput; if (!out) return;
        const frag = document.createDocumentFragment();
        const messagesToRender = this.consoleBuffer.splice(0);
        const shouldScroll = out.scrollTop + out.clientHeight >= out.scrollHeight - 30;
        for (const msg of messagesToRender) { const div = document.createElement('div'); div.className = `console-message console-${msg.type}`; div.textContent = msg.text; frag.appendChild(div); }
        out.appendChild(frag);
        const excessNodes = out.childNodes.length - this.MAX_CONSOLE_LINES;
        if (excessNodes > 0) { for (let i = 0; i < excessNodes; i++) { if (out.firstChild) out.removeChild(out.firstChild); } }
        if (shouldScroll) out.scrollTop = out.scrollHeight;
        this.isConsoleUpdateScheduled = false;
        if (this.consoleBuffer.length > 0) { this.isConsoleUpdateScheduled = true; setTimeout(() => this.flushConsoleBuffer(), this.CONSOLE_UPDATE_INTERVAL); }
    }

        showUploadModal(state) {
        const iconContainer = this.ui.uploadModalIcon;
        const messageEl = this.ui.uploadModalMessage;
        iconContainer.className = 'upload-status-icon';
        switch(state) {
            case 'uploading':
                iconContainer.classList.add('uploading');
                iconContainer.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`;
                messageEl.textContent = 'Uploading to device...';
                break;
            case 'success':
                iconContainer.classList.add('success');
                iconContainer.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
                messageEl.textContent = 'Upload Complete!';
                break;
            case 'error':
                iconContainer.classList.add('error');
                iconContainer.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
                messageEl.textContent = 'Upload Failed';
                break;
        }
        this.ui.uploadModal.style.display = 'flex';
    }

    hideUploadModal() { this.ui.uploadModal.style.display = 'none'; }


    // --- DATA & EVENT HANDLING ---

    handleData(data) {
        // This logic is moved directly from the old `setupCommCallbacks` method.
        let lineBuffer = this.lastDataBuffer + data;
        let newlineIndex;
        
        while ((newlineIndex = lineBuffer.indexOf('\n')) !== -1) {
            const line = lineBuffer.slice(0, newlineIndex).trim();
            lineBuffer = lineBuffer.slice(newlineIndex + 1);

            if (line.startsWith('AI_CMD:')) {
                this.aiManager.executeAiCommandFromBoard(line);
            } else if (line.includes('File "<stdin>", line')) {
                const errorMatch = line.match(/line (\d+)/);
                if (errorMatch && errorMatch[1]) {
                    this.handleErrorHighlighting(parseInt(errorMatch[1], 10));
                }
                this.addConsoleMessage(line, 'error');
            } else if (line.startsWith('plot:')) {
                this.addPlotterData(line);
            } else if (line) {
                this.addConsoleMessage(line, 'output');
            }
        }
        
        // Store any partial line that's left over
        this.lastDataBuffer = lineBuffer;
    }
    
    handleErrorHighlighting(lineNumber) {
        if (!this.currentCode || !window.blockyManagerInstance) return;

        console.log(`Error on line ${lineNumber}. Searching for block...`);
        const codeLines = this.codeWithBlockIds.split('\n');
        let blockId = null;

        for (let i = lineNumber - 1; i >= 0; i--) {
            const line = codeLines[i];
            const match = line.match(/^\s*# block_id=([a-zA-Z0-9\-_!@#$%^&*()_=+.,'":;?/~`|{}[\]]+)/);
            if (match && match[1]) {
                blockId = match[1];
                break;
            }
        }

        if (blockId) {
            this.addConsoleMessage(`Highlighting block corresponding to line ${lineNumber}.`, 'info');
            const workspace = window.blockyManagerInstance.workspace;
            this.switchView('blocks');
            workspace.highlightBlock(blockId);
        } else {
            console.log(`No block ID found for line ${lineNumber}.`);
        }
    }

    addPlotterData(line) {
    if (!this.plotterChart) return;

    const parts = line.split(':');
    if (parts.length < 4 || parts[0] !== 'plot') return;

    const name = parts[1].replace(/"/g, '');
    const color = parts[2];
    const value = parseFloat(parts[3]);

    if (isNaN(value)) return;

    let dataset = this.plotterChart.data.datasets.find(ds => ds.label === name);

    // If this data series is new, create it
    if (!dataset) {
        dataset = {
            label: name,
            data: new Array(this.plotterDataPointCount).fill(null), // Pad with nulls for previous data points
            borderColor: color,
            backgroundColor: `${color}33`,
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.3,
            fill: true
        };
        this.plotterChart.data.datasets.push(dataset);
    } else {
        if (dataset.borderColor !== color) {
            dataset.borderColor = color;
            dataset.backgroundColor = `${color}33`;
        }
    }
    this.plotterChart.data.labels.push(this.plotterDataPointCount++);
    this.plotterChart.data.datasets.forEach(ds => {
        if (ds.label === name) {
            ds.data.push(value);
        } else {
            ds.data.push(null); 
        }
    });
    if (this.plotterChart.data.labels.length > this.MAX_PLOTTER_POINTS) {
        this.plotterChart.data.labels.shift();
        this.plotterChart.data.datasets.forEach(ds => {
            ds.data.shift();
        });
    }

    this.plotterChart.update('none');
    }

    // --- PROJECT & FILE STATE MANAGEMENT ---

    async saveWorkspaceToCache() {
        if (!this.blocklyManager || !this.blocklyManager.workspace) return;

        try {
            // 1. Save the current open file's content
            if (this.activeFile !== 'main.py' && this.monacoEditor) {
                this.projectFiles[this.activeFile] = this.monacoEditor.getValue();
            }
            const workspaceJson = Blockly.serialization.workspaces.save(this.blocklyManager.workspace);
            this.projectFiles['main.py'] = JSON.stringify(workspaceJson);
            await saveWorkspace(this.projectName, this.projectFiles);

            // 2. Get the current project object
            const projects = await getAllProjects();
            const project = projects.find(p => p.name === this.projectName);
            if (!project) return;

            // 3. UNIFY: Add extensions and dashboard state to the main project object
            project.modifiedAt = Date.now();
            project.extensions = Array.from(this.loadedExtensions);
            project.dashboard = this.dashboardBuilder.getDashboardState();
            project.customModelLoaded = this.aiManager.isModelSuccessfullyLoaded; 
            project.customModelUrl = this.aiManager.customModelUrl;

            // 4. Save the complete, unified project object
            await saveProject(project);

        } catch (e) {
            console.error('Auto-save failed:', e);
        }
    }

    async loadWorkspaceFromCache() {
        // 1. Load the main, unified project object first
        const projects = await getAllProjects();
        const project = projects.find(p => p.name === this.projectName);

        if (project && project.customModelLoaded) {
            this.aiManager.isModelSuccessfullyLoaded = true;
            this.aiManager.customModelUrl = project.customModelUrl;
        }

        // 2. Load extensions from the unified project object
        this.loadedExtensions.clear();
        if (project && Array.isArray(project.extensions)) {
            project.extensions.forEach(extId => this.addExtension(extId));
        }

        // 3. Load the dashboard state from the unified project object
        if (project && project.dashboard) {
            this.dashboardBuilder.loadDashboardState(project.dashboard);
        }

        // 4. Load the code files (workspace)
        const projectData = await getWorkspace(this.projectName);
        if (projectData && typeof projectData === 'object') {
            this.projectFiles = projectData;
            this.addConsoleMessage(`Loaded project "${this.projectName}".`, 'info');
        } else {
            this.projectFiles = structuredClone(DEFAULT_PROJECT);
            this.addConsoleMessage(`Started new project "${this.projectName}".`, 'info');
        }

        // 5. Render UI
        this.renderFileTree();
        this.openFile('main.py');

        this.updateAiMonitorVisibility(); 
    }

    async openFile(filePath) {
        if (this.activeFile !== filePath) {
             await this.saveWorkspaceToCache();
        }
    
        this.activeFile = filePath;
        const isBlocklyFile = (filePath === 'main.py');
    
        if (isBlocklyFile) {
            this.isCodeOnlyMode = false;
            document.getElementById('read-only-banner').style.display = 'none';
            this.monacoEditor.updateOptions({ readOnly: false });
            this.ui.blocksViewBtn.disabled = false;
        } else {
            this.isCodeOnlyMode = true;
            document.getElementById('read-only-banner').style.display = 'none';
            this.monacoEditor.updateOptions({ readOnly: false });
            this.ui.blocksViewBtn.disabled = true;
        }
    
        if (isBlocklyFile) {
            const workspace = this.blocklyManager.workspace; 
            workspace.clear();
            const projectContent = this.projectFiles['main.py'] || DEFAULT_PROJECT['main.py'];
            
            try {
                let jsonData;
                if (projectContent.trim().startsWith('{')) {
                    jsonData = JSON.parse(projectContent);
                    Blockly.serialization.workspaces.load(jsonData, workspace);
                } else {
                    console.log("Loading legacy XML workspace.");
                    const dom = Blockly.utils.xml.textToDom(projectContent);
                    Blockly.Xml.domToWorkspace(dom, workspace);
                }

            } catch (e) {
                console.error("Error loading workspace content:", e);
                const dom = Blockly.utils.xml.textToDom(DEFAULT_PROJECT['main.py']);
                Blockly.Xml.domToWorkspace(dom, workspace);
            }
            
            if (this.blocklyManager) { 
                this.blocklyManager.generateCode(); 
            }
            
        } else {
            this.monacoEditor.setValue(this.projectFiles[filePath] || `# New file: ${filePath}`);
        }
        
        this.renderFileTree();
    }
    
    async deleteFile(filePath) {
        if (!confirm(`Are you sure you want to delete "${filePath}"? This cannot be undone.`)) {
        return;
        }

        // Prevent deleting the currently open file without switching away first
        if (this.activeFile === filePath) {
            // Switch to a safe default before deleting
            await this.openFile('main.py');
        }

        delete this.projectFiles[filePath];
        
        await this.saveWorkspaceToCache();
        this.renderFileTree(); // Re-render the UI to show the file is gone

        this.addConsoleMessage(`Deleted "${filePath}" from the project.`, 'info');
    }

    renderFileTree(temporaryFile = null) {
        const container = document.getElementById('file-tree-container');
        container.innerHTML = '';
    
        const ICONS = {
            main: '<svg viewBox="0 0 24 24"><path d="M10 3H4v6h6V3zm7 0h-6v6h6V3zm7 0h-6v6h6V3zm-7 7h-6v6h6v-6zm7 0h-6v6h6v-6zm-7 7h-6v6h6v-6z"/></svg>',
            boot: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
            python: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
            generic: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
        };

        const createItem = (filePath, isTemp) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'file-item';
            itemEl.dataset.filePath = filePath;
            if (filePath === this.activeFile) itemEl.classList.add('active');
        
            let iconHtml, iconClass = 'file-item-icon';
            if (filePath === 'main.py') { iconHtml = ICONS.main; iconClass += ' main-py-icon'; } 
            else if (filePath === 'boot.py') { iconHtml = ICONS.boot; } 
            else if (filePath.endsWith('.py')) { iconHtml = ICONS.python; } 
            else { iconHtml = ICONS.generic; }

            itemEl.innerHTML = `<div class="${iconClass}">${iconHtml}</div><span class="file-item-name">${filePath}</span>`;

            if (!isTemp && filePath !== 'main.py' && filePath !== 'boot.py') {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'file-delete-btn';
                deleteBtn.innerHTML = '&times;';
                deleteBtn.title = `Delete ${filePath}`;
                deleteBtn.onclick = (e) => { e.stopPropagation(); this.deleteFile(filePath); };
                itemEl.appendChild(deleteBtn);
            }

            itemEl.addEventListener('click', () => {
                 // Only allow clicking on non-temporary project files
                if (!isTemp) this.openFile(filePath);
            });
            return itemEl;
        };

        // 1. Render all REAL project files
        const projectFiles = Object.keys(this.projectFiles).sort((a, b) => {
            if (a === 'main.py') return -1; if (b === 'main.py') return 1;
            if (a === 'boot.py') return -1; if (b === 'boot.py') return 1;
            return a.localeCompare(b);
        });
        projectFiles.forEach(fp => container.appendChild(createItem(fp, false)));

        // 2. If a temporary file is specified and not already in the project, render it
        if (temporaryFile && !this.projectFiles[temporaryFile]) {
            container.appendChild(createItem(temporaryFile, true));
        }
    }
    
    async handleCreateNewFile() {
        const fileName = this.ui.newFileNameInput.value.trim();

        if (!fileName) {
        return; // Should not happen due to disabled button, but good practice
        }

        if (this.projectFiles[fileName]) {
            alert(`File "${fileName}" already exists.`);
            return;
        }

        // Add the new empty file to our project structure
        this.projectFiles[fileName] = `# New file: ${fileName}\n`;
    
        // Save the updated project structure
        await this.saveWorkspaceToCache();

        // Close the modal
        this.closeNewFileModal();

        // Re-render the tree and open the new file
        this.renderFileTree();
        this.openFile(fileName);
    
        this.addConsoleMessage(`Created new file: ${fileName}`, 'success');
    }
    
    async handleProjectRename() {
        const oldName = this.projectName;

        // Use the modern showCustomPrompt which is already imported
        const newName = await new Promise(resolve => {
            showCustomPrompt(`Rename project "${oldName}" to:`, oldName, resolve);
        });

        if (!newName || newName.trim() === '' || newName === oldName) {
            return; // User cancelled or didn't change the name
        }

        const finalName = newName.trim();

        try {
            const allProjects = await getAllProjects();
            if (allProjects.some(p => p.name === finalName)) {
                alert(`A project named "${finalName}" already exists. Please choose a different name.`);
                return;
            }

            // 1. Find the old project data
            const projectToRename = allProjects.find(p => p.name === oldName);
            if (!projectToRename) {
                alert("Could not find the original project to rename. It may have been deleted.");
                return;
            }

            // 2. Get the workspace and extensions data using the old name
            const workspaceData = await getWorkspace(oldName);
            const extensionsData = await getExtensions(oldName);

            // 3. Create the new project entry and save its data
            const renamedProject = { ...projectToRename, name: finalName, modifiedAt: Date.now() };
            await saveProject(renamedProject);
            if (workspaceData) await saveWorkspace(finalName, workspaceData);
            if (extensionsData) await saveExtensions(finalName, extensionsData);
    
            // 4. Delete the old project entry and its data
            await deleteProjectByName(oldName);

            // 5. Update the current IDE state and UI
            this.projectName = finalName;
            this.originalProjectName = finalName;
            this.ui.projectName.textContent = finalName;
            document.title = `${this.projectName} - ${this.boardId.toUpperCase()} | Block IDE`;
            this.addConsoleMessage(`Project renamed to "${finalName}".`, 'success');
        
            // 6. Update the URL to reflect the new name without reloading
            const newUrl = `${window.location.pathname}?project=${encodeURIComponent(finalName)}&board=${this.boardId}`;
            window.history.pushState({ path: newUrl }, '', newUrl);

        } catch (error) {
            console.error("Failed to rename project:", error);
            alert("An error occurred while renaming the project. Please check the console.");
            // Revert UI on failure
            this.ui.projectName.textContent = oldName;
        }
    }

    updateToolboxWithCustomClasses() {
        if (!this.blocklyManager) return;
        console.log('[IDE] Refreshing toolbox for custom model classes.');
        this.blocklyManager.rebuildToolboxForCustomModel();
    }

    handleTestCustomModel(url) {
        if (!url || !url.startsWith('https://teachablemachine.withgoogle.com/models/')) {
            alert("Please provide a valid Teachable Machine model URL.");
            return;
        }
        console.log(`[IDE] Requesting AI Manager to test model from: ${url}`);
        this.aiManager.loadAndTestInMonitor(url); 
    }


    async handleProjectShare() {
        this.addConsoleMessage('Generating shareable link...', 'info');
    
        try {
            // 1. Gather all project data
            const workspace = window.blockyManagerInstance.workspace;
            const dom = Blockly.Xml.workspaceToDom(workspace);
            const xml = Blockly.Xml.domToText(dom);
    
            const projectData = {
                projectName: this.projectName,
                workspaceXML: xml,
                extensions: Array.from(this.loadedExtensions),
            };
    
            // 2. Compress and Encode
            const jsonString = JSON.stringify(projectData);
            const compressed = pako.deflate(jsonString);
            const encodedData = toBase64URL(compressed);
    
            // 3. Construct the URL
            const url = new URL(window.location.href);
            url.searchParams.delete('project'); // Remove old project param
            url.searchParams.set('board', this.boardId); // Ensure board is set
            url.searchParams.set('project_data', encodedData);
    
            // 4. Copy to clipboard and give feedback
        await navigator.clipboard.writeText(url.toString());
        const originalContent = this.ui.shareProjectBtn.innerHTML;
        this.ui.shareProjectBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>
            <span>Copied!</span>
        `;
        this.ui.shareProjectBtn.classList.add('success');
        this.addConsoleMessage('✅ Link copied to clipboard!', 'success');
    
        // After 2.5 seconds, restore the original content
        setTimeout(() => {
            this.ui.shareProjectBtn.innerHTML = originalContent;
            this.ui.shareProjectBtn.classList.remove('success');
        }, 2500);
    
        } catch (e) {
            console.error('Failed to generate share link:', e);
            this.addConsoleMessage(`Error generating link: ${e.message}`, 'error');
        }
    }
    
    async loadProjectFromURLData(encodedData) {
        this.addConsoleMessage('Loading project from shared link...', 'info');
        try {
            // 1. Decode and Decompress
            const compressed = fromBase64URL(encodedData);
            const jsonString = pako.inflate(compressed, { to: 'string' });
            const projectData = JSON.parse(jsonString);
    
            // 2. Load Extensions FIRST
            this.loadedExtensions.clear();
            if (projectData.extensions && Array.isArray(projectData.extensions)) {
                projectData.extensions.forEach(extId => this.addExtension(extId));
            }
            
            // 3. Load Workspace
            const workspace = window.blockyManagerInstance.workspace;
            workspace.clear();
            const dom = Blockly.utils.xml.textToDom(projectData.workspaceXML);
            Blockly.Xml.domToWorkspace(dom, workspace);
    
            // 4. Update UI and internal state
            this.projectName = projectData.projectName || 'Shared-Project';
            this.ui.projectName.textContent = this.projectName;
            document.title = `${this.projectName} - ${this.boardId.toUpperCase()} | Block IDE`;
            this.addConsoleMessage(`Successfully loaded "${this.projectName}".`, 'success');
    
            // 5. Prompt user to save it locally
            setTimeout(() => {
                showCustomConfirm(
                    `You have opened a shared project named "${this.projectName}". Would you like to save it to your local projects?`,
                    (confirmed) => {
                        if (confirmed) {
                            this.promptAndSaveSharedProject();
                        }
                    }
                );
            }, 500);
    
        } catch (e) {
            console.error('Failed to load shared project:', e);
            this.addConsoleMessage(`Error loading shared link: ${e.message}. Loading default project.`, 'error');
            this.loadDefaultBlocks();
        }
    }
    
    async exportProject() {
        // Ensure the latest state is saved internally first
        await this.saveWorkspaceToCache();

        this.addConsoleMessage('Exporting project as .zip file...', 'info');

        try {
            const zip = new JSZip();

            // 1. Create the project.json manifest file
            const manifest = {
                name: this.projectName,
                boardId: this.boardId,
                extensions: Array.from(this.loadedExtensions),
                dashboard: this.dashboardBuilder.getDashboardState(),
                // We no longer store code in the manifest for zips
            };
            zip.file("project.json", JSON.stringify(manifest, null, 2));

            // 2. Add all project code files to the zip
            const currentWorkspaceFiles = await getWorkspace(this.projectName);
            for (const [filePath, fileContent] of Object.entries(currentWorkspaceFiles)) {
                if (filePath.startsWith('lib/')) {
                    zip.folder('lib');
                }
                zip.file(filePath, fileContent);
            }

            // 3. Generate the zip file and trigger download
            const blob = await zip.generateAsync({ type: 'blob' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${this.projectName}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);

            this.addConsoleMessage('Project exported successfully.', 'success');

        } catch (e) {
            this.addConsoleMessage(`Export failed: ${e.message}`, 'error');
            console.error(e);
        }
    }


    // --- EXTENSION & TOOLBOX MANAGEMENT ---

    addExtension(extensionId) {
        if (this.loadedExtensions.has(extensionId) || !this.blocklyManager) return;
        
        if (extensionId === 'iot_dashboard') {
            this.dashboardBuilder.setupDashboardBlocks(); 
        }
        this.loadedExtensions.add(extensionId);
        this.blocklyManager.rebuildAndApplyToolbox(
            this.loadedExtensions, 
            this.dashboardBuilder.getDashboardBlockDefinitions()
        );
        
        this.saveExtensionsToCache();
        this.addConsoleMessage(`Extension '${extensionId}' added.`, 'info');
        
        this.updateAiMonitorVisibility();
        this.updateDashboardVisibility(); 
    }

    removeExtension(extensionId) {
        if (!this.loadedExtensions.has(extensionId) || !this.blocklyManager) return;
        
        this.cleanupBlocksForExtension(extensionId); 
        this.loadedExtensions.delete(extensionId);

        if (extensionId === 'iot_dashboard') {
            this.dashboardBuilder.clearDashboardBlocks(); 
        }

        this.blocklyManager.rebuildAndApplyToolbox(
            this.loadedExtensions, 
            this.dashboardBuilder.getDashboardBlockDefinitions()
        );

        this.saveExtensionsToCache();
        this.addConsoleMessage(`Extension '${extensionId}' removed.`, 'info');

        this.updateAiMonitorVisibility();
        this.updateDashboardVisibility();
        
        this.showExtensionModal();
    }

    cleanupBlocksForExtension(extensionId) {
        const blockTypesToRemove = EXTENSION_BLOCK_TYPES[extensionId];
        if (!blockTypesToRemove || !this.blocklyManager || !this.blocklyManager.workspace) {
            return;
        }

        const workspace = this.blocklyManager.workspace;
        const allBlocks = workspace.getAllBlocks(false);
        
        // Group all deletions into a single event for better undo/redo
        Blockly.Events.setGroup(true);
        try {
            allBlocks.forEach(block => {
                if (blockTypesToRemove.includes(block.type)) {
                    // Dispose of the block without triggering a new change event for each one
                    block.dispose(true); 
                }
            });
        } finally {
            Blockly.Events.setGroup(false);
        }
        
        this.addConsoleMessage(`Cleaned up blocks for extension: ${extensionId}`, 'info');
    }

    async saveExtensionsToCache() {
        await saveExtensions(this.projectName, Array.from(this.loadedExtensions));
    }

    async loadExtensionsFromCache() {
        const savedExtensions = await getExtensions(this.projectName);
        if (savedExtensions) {
            savedExtensions.forEach(extId => { setTimeout(() => this.addExtension(extId), 50); });
        }
    }

    showExtensionModal() {
        this.ui.extensionList.innerHTML = ''; // Clear previous list

        // --- ADD FILTERING LOGIC ---
        const availableForBoard = this.availableExtensions.filter(ext => 
            !ext.boards || ext.boards.includes(this.boardId)
        );
        
        if (availableForBoard.length === 0) {
            this.ui.extensionList.innerHTML = '<p>No extensions are currently available for this board.</p>';
        } else {
            // Use the filtered list to render the cards
            availableForBoard.forEach(ext => {
                const card = document.createElement('div');
                // ... rest of the function is unchanged, it will work with the filtered list
                card.className = 'extension-card';
                card.dataset.extensionId = ext.id;

                if (this.loadedExtensions.has(ext.id)) {
                    card.classList.add('added');
                    card.innerHTML = `
                        <div class="extension-card-icon" style="background-color: ${ext.color};">${ext.icon}</div>
                        <h3>${ext.name}</h3>
                        <p>${ext.description}</p>
                        <button class="btn danger remove-ext-btn">Remove</button>`;
                    
                    card.querySelector('.remove-ext-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.removeExtension(ext.id);
                    });

                } else {
                    card.innerHTML = `
                        <div class="extension-card-icon" style="background-color: ${ext.color};">${ext.icon}</div>
                        <h3>${ext.name}</h3>
                        <p>${ext.description}</p>`;
                    
                    card.addEventListener('click', () => {
                        this.addExtension(ext.id);
                        this.ui.extensionModal.style.display = 'none';
                    });
                }
                this.ui.extensionList.appendChild(card);
            });
        }
        this.ui.extensionModal.style.display = 'flex';
    }

    // --- INTERACTIVE FEATURES ---

    registerBlocklyContextMenu() {
            const myCommand = {
                displayText: "⚡ Run this block on device",
                preconditionFn: (scope) => {
                    return (this.isLiveMode && this.comm.isConnected) ? 'enabled' : 'hidden';
                },
                callback: (scope) => {
                    this.executeBlockViaRepl(scope.block);
                },
                scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
                id: 'run_block_on_device',
                weight: 200,
            };
            Blockly.ContextMenuRegistry.registry.register(myCommand);
        }

    // Toggles Live Mode on/off
    handleLiveModeToggle() {
        if (!this.comm.isConnected) return;
        this.isLiveMode = !this.isLiveMode;
        this.ui.liveModeBtn.classList.toggle('active', this.isLiveMode);
        
        if (this.isLiveMode) {
            this.addConsoleMessage("⚡ Live Mode Activated. Right-click blocks to run them.", "info");
            this.comm.sendData('\x03'); // Send CTRL+C to interrupt any running script
        } else {
            this.addConsoleMessage("⚡ Live Mode Deactivated.", "info");
        }
    }
    
    // Generates code for a single block and sends it over serial
    async executeBlockViaRepl(block) {
        if (!this.isLiveMode || !this.comm.isConnected) return;

        const nonExecutableTypes = new Set([
            'on_start', 'forever', 'every_x_ms', 'controls_repeat_ext',
            'controls_whileUntil', 'controls_for', 'controls_forEach'
        ]);

        if (nonExecutableTypes.has(block.type)) {
            this.addConsoleMessage("⚡ Live Mode can only run individual action blocks, not loops or events.", "info");
            return;
        }
        
        this.pythonGenerator.isLiveMode = true;
        let code = Blockly.Python.blockToCode(block, true);
        this.pythonGenerator.isLiveMode = false; // Reset the flag immediately after use

        if (!code || !code.trim()) return;
        
        // If the block returns a value, wrap it in a print() statement.
        // This check must happen *before* we enter paste mode.
        if (block.outputConnection && !code.includes('\n')) {
            code = `print(${code})`;
        }

        this.addConsoleMessage(`>>> (Live) ${code.trim().replace(/\n/g, '\n... ')}`, "input");
        
        try {
            // Use MicroPython's paste mode for reliable multi-line execution
            await this.comm.sendData('\x05'); // CTRL+E: Enter Paste Mode
            await new Promise(r => setTimeout(r, 50));
            await this.comm.sendData(code + '\r\n');
            await new Promise(r => setTimeout(r, 50));
            await this.comm.sendData('\x04'); // CTRL+D: Execute
        } catch (e) {
            this.addConsoleMessage(`Live Mode Error: ${e.message}`, 'error');
            await this.comm.sendData('\x03'); // Send CTRL+C to recover REPL
        }
    }

    openTutorialModal() {
        const listContainer = this.ui.tutorialList;
        listContainer.innerHTML = ''; // Clear previous content

        // We reuse the 'extension-card' CSS classes for a consistent look
        tutorials.forEach(tutorial => {
            if (tutorial.steps.length === 0) return; // Don't show empty tutorials

            const card = document.createElement('div');
            card.className = 'extension-card';
            card.innerHTML = `
                <div class="extension-card-icon" style="background-color: var(--accent-primary);">${tutorial.icon}</div>
                <h3>${tutorial.title}</h3>
                <p>${tutorial.description}</p>
            `;
        
            card.addEventListener('click', () => {
                this.ui.tutorialModal.style.display = 'none'; // Close the modal
                this.startTutorial(tutorial.steps); // Start the selected tutorial
            });

            listContainer.appendChild(card);
        });

        this.ui.tutorialModal.style.display = 'flex';
    }

    startTutorial(steps) {
        const tour = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                cancelIcon: {
                    enabled: true
                },
            classes: 'shadow-md bg-purple-dark',
            scrollTo: { behavior: 'smooth', block: 'center' }
            }
        });

        tour.addSteps(steps);
        tour.start();
    }
    
    // --- DELEGATED METHODS (Examples of how to call managers) ---

loadCodeIntoEditor(fileName, code) {
        // 1. Update the state to reflect that we are in a special, read-only mode.
        this.activeFile = fileName;
        this.isCodeOnlyMode = true;

        // 2. Update the Monaco editor with the content and set it to read-only.
        if (this.monacoEditor) {
            this.monacoEditor.setValue(code);
            this.monacoEditor.updateOptions({ readOnly: true });
        }

        // 3. Update the UI to show the read-only status and disable block editing.
        document.getElementById('read-only-banner').style.display = 'flex';
        this.ui.blocksViewBtn.disabled = true;

        // 4. Re-render the file tree, passing the temporary file so it appears in the list.
        // This makes it clear to the user which device file they are currently viewing.
        this.renderFileTree(fileName);

        // 5. Switch to the code view to show the editor.
        this.switchView('code');

        this.addConsoleMessage(`Loaded "${fileName}" from device in read-only mode.`, "info");
    }


async uploadCodeToDevice() {
    if (!this.commManager.isConnected()) {
        return alert("Device is not connected.");
    }
    
    // 1. Pause the AI stream and interrupt the device BEFORE doing anything else.
    this.aiManager.pauseAiStream();
    try {
        await this.commManager.sendData('\x03'); // Send CTRL+C to stop any running script
        await new Promise(r => setTimeout(r, 250)); // Give the device a moment to clear its buffer and respond
    } catch (e) {
        console.warn("Could not send initial CTRL+C, proceeding anyway.", e);
    }

    try {
        await this.saveWorkspaceToCache();
        if (this.blocklyManager) {
            this.pythonGenerator.connectionType = this.commManager.getConnectionType();
            this.blocklyManager.generateCode();
        }
        const filesToUpload = { ...this.projectFiles };
        filesToUpload['main.py'] = this.currentCode;

        this.showUploadModal('uploading');
        this.addConsoleMessage('Starting project sync...', 'info');

        await this.deviceFileManager.uploadProject(filesToUpload);
        await this.commManager.sendData('\x04'); // Soft reboot (CTRL+D)
        
        this.showUploadModal('success');
        this.addConsoleMessage('✅ Project sync complete! Rebooting device...', 'success');

    } catch (e) {
        this.showUploadModal('error');
        const errorMessage = (e instanceof Error) ? e.message : String(e);
        this.addConsoleMessage(`❌ Upload failed: ${errorMessage}`, 'error');
        console.error("Full upload error object:", e);
    } finally {
        // 2. ALWAYS resume the AI stream, whether the upload succeeded or failed.
        this.aiManager.resumeAiStream();
        setTimeout(() => this.hideUploadModal(), 2000);
        this.updateUI();
    }
}

}


export { ESP32BlockIDE };

