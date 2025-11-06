// src/renderer/managers/AiVisionManager.js (FINAL & DECOUPLED)
'use strict';

import * as vision from '@mediapipe/tasks-vision';
const { FaceLandmarker, GestureRecognizer, ImageClassifier, ObjectDetector, FilesetResolver, DrawingUtils } = vision;
import * as tmImage from '@teachablemachine/image';

export class AiVisionManager {
    constructor(commManager, ideInstance) {
        this.commManager = commManager;
        this.ide = ideInstance;

        // UI Elements
        this.ui = {
            sidebarWebcam: document.getElementById('sidebar-webcam'),
            sidebarCanvas: document.getElementById('sidebar-canvas-overlay'),
            boardViewerContainer: document.getElementById('board-viewer-container'),
            aiMonitorModal: document.getElementById('ai-monitor-modal'),
            aiMonitorHeader: document.getElementById('ai-monitor-header'),
            aiMonitorCanvas: document.getElementById('ai-monitor-canvas'),
            aiMonitorDataOutput: document.getElementById('ai-monitor-data-output'),
            aiMonitorToggles: document.querySelectorAll('.ai-monitor-toggle'),
            aiMonitorCloseBtn: document.getElementById('ai-monitor-close-btn'),
            aiMonitorBtn: document.getElementById('ai-monitor-btn'),
            customModelToggle: document.querySelector('.ai-monitor-toggle[data-model="custom"]'),
        };

        // --- DECOUPLED STATE MANAGEMENT ---
        this.isBlocksRequestingAi = false;  // True if blocks in the workspace require AI.
        this.isMonitorRequestingAi = false; // True if the AI Monitor modal is open.
        this.isStreamPaused = false;        // True to temporarily stop sending data to the device (e.g., during upload).
        
        // --- Core State ---
        this.isCameraOn = false;
        this.mediaStream = null;
        this.aiRequestAnimationFrameId = null;
        this.lastAiSendTime = 0;
        this.AI_SEND_INTERVAL_MS = 100;
        this.lastAiDataJson = '';
        this.activeMonitorModel = null;
        this.isFaceLandmarkerInitializedWithBlendshapes = false;
        
        // --- MediaPipe Models & Utils ---
        this.faceLandmarker = null;
        this.gestureRecognizer = null;
        this.imageClassifier = null;
        this.objectDetector = null;
        this.sidebarCanvasCtx = this.ui.sidebarCanvas.getContext('2d');
        this.aiMonitorCanvasCtx = this.ui.aiMonitorCanvas.getContext('2d');

        this.customModel = null;
        this.customModelLabels = [];
        this.customModelUrl = null;
        this.isModelSuccessfullyLoaded = false;
        
        // Requirements determined by blocks in the workspace
        this.aiRequirements = {
            needsFaceCount: false,
            needsBlendshapes: false,
            needsHands: false,
            needsGestures: false,
            needsClassification: false,
            needsObjectDetection: false,
            needsCustomModel: false,
        };

        this._initEventListeners();
    }

    _initEventListeners() {
        this.ui.aiMonitorBtn.addEventListener('click', () => {
            this.toggleAiMonitorModal(true, this.ide.loadedExtensions);
        });

        this.ui.aiMonitorCloseBtn.addEventListener('click', () => this.toggleAiMonitorModal(false));

        this.ui.aiMonitorToggles.forEach(toggle => {
            toggle.addEventListener('click', async () => {
                const model = toggle.dataset.model;
                const isActive = toggle.classList.contains('active');

                this.ui.aiMonitorToggles.forEach(t => {
                    t.classList.remove('active');
                    t.style.backgroundColor = '';
                    t.style.borderColor = '';
                });

                if (isActive) {
                    this.activeMonitorModel = null;
                    this.ui.aiMonitorHeader.style.borderColor = '';
                } else {
                    toggle.classList.add('active');
                    this.activeMonitorModel = model;
                    const extension = this.ide.availableExtensions.find(ext => ext.id.startsWith(model));
                    if (extension) {
                        const newColor = extension.color;
                        this.ui.aiMonitorHeader.style.borderColor = newColor;
                        toggle.style.backgroundColor = newColor;
                        toggle.style.borderColor = newColor;
                    }
                    // When in monitor mode, always initialize the full-featured model.
                    if (this.activeMonitorModel) {
                        switch(this.activeMonitorModel) {
                            case 'face': await this.initFaceLandmarker(true); break;
                            case 'hand': await this.initGestureRecognizer(); break;
                            case 'classification': await this.initImageClassifier(); break;
                            case 'detection': await this.initObjectDetector(); break;
                        }
                    }
                }
            });
        });

        document.addEventListener('visibilitychange', () => {
            const shouldBeRunning = this.isBlocksRequestingAi || this.isMonitorRequestingAi;
            if (!shouldBeRunning) return;

            if (document.hidden) {
                if (this.aiRequestAnimationFrameId) cancelAnimationFrame(this.aiRequestAnimationFrameId);
                this.aiRequestAnimationFrameId = null;
                if (this.mediaStream) this.mediaStream.getTracks().forEach(track => track.enabled = false);
            } else {
                if (this.mediaStream) this.mediaStream.getTracks().forEach(track => track.enabled = true);
                if (!this.aiRequestAnimationFrameId) this.aiRequestAnimationFrameId = requestAnimationFrame(this.predictWebcam.bind(this));
            }
        });
    }

    isCustomModelLoadedFor(url) {
        return this.isModelSuccessfullyLoaded && this.customModelUrl === url;
    }

    async loadAndTestInMonitor(url) {
        this.ide.addConsoleMessage(`Attempting to load custom model... (Phase 2)`, 'info');
        this.toggleAiMonitorModal(true, this.ide.loadedExtensions);
    }

    async loadAndTestInMonitor(url) {
        if (this.customModelUrl === url && this.customModel) {
            this.ide.addConsoleMessage('This model is already loaded. Opening monitor.', 'info');
            this.toggleAiMonitorModal(true, this.ide.loadedExtensions);
            this.ui.customModelToggle.click();
            return;
        }

        this.ide.addConsoleMessage(`Loading custom model from URL...`, 'info');
        await this.toggleAiMonitorModal(true, this.ide.loadedExtensions);
        this.ui.aiMonitorDataOutput.innerHTML = `<p class="ai-monitor-placeholder">Loading model from Teachable Machine...</p>`;
        
        try {
            const modelURL = `${url}model.json`;
            const metadataURL = `${url}metadata.json`;

            // Load the model and metadata
            const loadedModel = await tmImage.load(modelURL, metadataURL);
            const classLabels = loadedModel.getClassLabels();

            // Success! Update state
            this.customModel = loadedModel;
            this.customModelLabels = classLabels; 
            this.customModelUrl = url;
            this.isModelSuccessfullyLoaded = true;

            this.ide.addConsoleMessage(`✅ Custom model loaded successfully with ${classLabels.length} classes.`, 'success');

            this.ui.customModelToggle.style.display = 'flex';
            this.ui.customModelToggle.click();

            this.ide.updateUIAfterModelLoad();

        } catch (error) {
            console.error("Failed to load custom model:", error);
            this.ide.addConsoleMessage(`❌ Error loading custom model: ${error.message}`, 'error');
            this.ui.aiMonitorDataOutput.innerHTML = `<p class="ai-monitor-placeholder" style="color:var(--accent-error)">Failed to load model.<br>Check the URL and console for errors.</p>`;
            
            this.customModel = null;
            this.customModelLabels = [];
            this.customModelUrl = null;

            this.ide.updateUIAfterModelLoad();
        }
    }

    async _updateAiVisionState() {
        const shouldBeRunning = this.isBlocksRequestingAi || this.isMonitorRequestingAi;
        const isCurrentlyRunning = this.aiRequestAnimationFrameId !== null;

        if (shouldBeRunning && !isCurrentlyRunning) {
            //console.log("AI Vision required. Starting system.");
            await this.turnCameraOn();
            if (this.mediaStream) {
                this.aiRequestAnimationFrameId = requestAnimationFrame(this.predictWebcam.bind(this));
            }
        } else if (!shouldBeRunning && isCurrentlyRunning) {
            //console.log("AI Vision no longer required. Stopping system.");
            if (this.aiRequestAnimationFrameId) {
                cancelAnimationFrame(this.aiRequestAnimationFrameId);
                this.aiRequestAnimationFrameId = null;
            }
            this._turnCameraOff();
        }
    }

    // --- PUBLIC METHODS FOR STATE CONTROL ---

    async updateAiStateFromBlocks() {
        this.analyzeAiBlockUsage(this.ide.blocklyManager?.workspace);
        const isAnyAiRequiredByBlocks = Object.values(this.aiRequirements).some(req => req);
        
        if (isAnyAiRequiredByBlocks !== this.isBlocksRequestingAi) {
            this.isBlocksRequestingAi = isAnyAiRequiredByBlocks;
            await this.updateAiModelsBasedOnRequirements();
            this._updateAiVisionState();
        }
    }

    async toggleAiMonitorModal(show, loadedExtensions = new Set()) {
        if (show) {
            this.ui.aiMonitorModal.style.display = 'flex';
            this.isMonitorRequestingAi = true;

            const extensionToModelMap = { 'face_landmark': 'face', 'hand_gesture': 'hand', 'image_classification': 'classification', 'object_detection': 'detection' };
            let firstVisibleToggle = null;

            this.ui.aiMonitorToggles.forEach(toggle => {
                const model = toggle.dataset.model;
                // Keep custom model button hidden unless a model is loaded
                if (model === 'custom') {
                    toggle.style.display = this.customModel ? 'flex' : 'none';
                    return;
                }
                const correspondingExtension = Object.keys(extensionToModelMap).find(key => extensionToModelMap[key] === model);
                const isVisible = (correspondingExtension && loadedExtensions.has(correspondingExtension));
                toggle.style.display = isVisible ? 'flex' : 'none';
                if (isVisible && !firstVisibleToggle) firstVisibleToggle = toggle;
            });
            
            this.ui.aiMonitorToggles.forEach(t => t.classList.remove('active'));
            this.activeMonitorModel = null;
            this.updateAiMonitorUI({});

            if (firstVisibleToggle) {
                firstVisibleToggle.click();
            } else if (!this.customModel) {
                this.ui.aiMonitorDataOutput.innerHTML = `<p class="ai-monitor-placeholder">No AI extensions are active.<br>Add one from the extension library to use the monitor.</p>`;
            }
            
            await this._updateAiVisionState();

        } else {
            this.ui.aiMonitorModal.style.display = 'none';
            this.isMonitorRequestingAi = false;
            this.activeMonitorModel = null;
            
            await this._updateAiVisionState();
        }
    }
    
    pauseAiStream() {
        this.isStreamPaused = true;
    }

    resumeAiStream() {
        this.isStreamPaused = false;
    }

    stopAiVision() {
        this.isBlocksRequestingAi = false;
        this.isMonitorRequestingAi = false;
        this._updateAiVisionState();
    }

    // --- CORE AI & DATA PROCESSING ---

    async predictWebcam() {
        const shouldBeRunning = this.isBlocksRequestingAi || this.isMonitorRequestingAi;
        if (!shouldBeRunning || document.hidden) {
            if (this.aiRequestAnimationFrameId) cancelAnimationFrame(this.aiRequestAnimationFrameId);
            this.aiRequestAnimationFrameId = null;
            return;
        }

        const video = this.ui.sidebarWebcam;
        if (video.readyState < 2) {
             this.aiRequestAnimationFrameId = requestAnimationFrame(this.predictWebcam.bind(this));
             return;
        }

        const startTimeMs = performance.now();
        const results = {};

        const isMonitoring = this.isMonitorRequestingAi;
        const runFace = isMonitoring ? this.activeMonitorModel === 'face' : (this.aiRequirements.needsFaceCount || this.aiRequirements.needsBlendshapes);
        const runHand = isMonitoring ? this.activeMonitorModel === 'hand' : (this.aiRequirements.needsGestures || this.aiRequirements.needsHands);
        const runClassify = isMonitoring ? this.activeMonitorModel === 'classification' : this.aiRequirements.needsClassification;
        const runDetect = isMonitoring ? this.activeMonitorModel === 'detection' : this.aiRequirements.needsObjectDetection;
        const runCustom = isMonitoring ? this.activeMonitorModel === 'custom' : this.aiRequirements.needsCustomModel;

        if (this.faceLandmarker && runFace) results.faceLandmarker = this.faceLandmarker.detectForVideo(video, startTimeMs);
        if (this.gestureRecognizer && runHand) results.gestureRecognizer = this.gestureRecognizer.recognizeForVideo(video, startTimeMs);
        if (this.imageClassifier && runClassify) results.imageClassifier = this.imageClassifier.classifyForVideo(video, startTimeMs);
        if (this.objectDetector && runDetect) results.objectDetector = this.objectDetector.detectForVideo(video, startTimeMs);
        if (this.customModel && runCustom) results.customModel = await this.customModel.predict(video);
        
        this.sidebarCanvasCtx.clearRect(0, 0, this.ui.sidebarCanvas.width, this.ui.sidebarCanvas.height);
        this.aiMonitorCanvasCtx.clearRect(0, 0, this.ui.aiMonitorCanvas.width, this.ui.aiMonitorCanvas.height);

        const activeCanvasCtx = isMonitoring ? this.aiMonitorCanvasCtx : this.sidebarCanvasCtx;
        
        activeCanvasCtx.save();
        activeCanvasCtx.scale(-1, 1);
        activeCanvasCtx.translate(-activeCanvasCtx.canvas.width, 0);
        activeCanvasCtx.drawImage(video, 0, 0, activeCanvasCtx.canvas.width, activeCanvasCtx.canvas.height);
        
        const drawingUtils = new DrawingUtils(activeCanvasCtx);
        if (results.faceLandmarker?.faceLandmarks) for (const landmarks of results.faceLandmarker.faceLandmarks) drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
        if (results.gestureRecognizer?.landmarks) for (const landmarks of results.gestureRecognizer.landmarks) drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#FFC107", lineWidth: 3 });
        
        activeCanvasCtx.restore();
        
        this.processAiResults(results);
        this.aiRequestAnimationFrameId = requestAnimationFrame(this.predictWebcam.bind(this));
    }

    async processAiResults(results) {
        if (!results) return;

        // If the monitor is active, it gets priority for UI updates.
        if (this.isMonitorRequestingAi) {
            this.updateAiMonitorUI(results);
        }

        // If blocks are requesting data and the stream is not paused, send to device.
        if (this.isBlocksRequestingAi && !this.isStreamPaused && this.commManager.isConnected()) {
            const now = performance.now();
            if (now - this.lastAiSendTime < this.AI_SEND_INTERVAL_MS) return;

            const dataToSend = {};
            if (this.aiRequirements.needsFaceCount || this.aiRequirements.needsBlendshapes) {
                const faceCount = results.faceLandmarker?.faceLandmarks?.length || 0;
                if (this.aiRequirements.needsFaceCount) dataToSend.face_count = faceCount;
                if (this.aiRequirements.needsBlendshapes) {
                    const blendshapes = {};
                    if (faceCount > 0 && results.faceLandmarker.faceBlendshapes[0]) {
                        results.faceLandmarker.faceBlendshapes[0].categories.forEach(c => { blendshapes[c.categoryName] = c.score; });
                    }
                    dataToSend.blendshapes = blendshapes;
                }
            }
            if (this.aiRequirements.needsHands || this.aiRequirements.needsGestures) {
                const hasHands = results.gestureRecognizer?.landmarks?.length > 0;
                if (this.aiRequirements.needsHands) {
                    dataToSend.hand_count = hasHands ? results.gestureRecognizer.landmarks.length : 0;
                    dataToSend.hands = hasHands ? results.gestureRecognizer.handedness.map(h => h[0].categoryName) : [];
                }
                if (this.aiRequirements.needsGestures) {
                    dataToSend.gestures = hasHands ? results.gestureRecognizer.gestures.flat().map(g => g.categoryName) : [];
                }
            }
            if (this.aiRequirements.needsClassification) {
                const topResult = results.imageClassifier?.classifications?.[0]?.categories?.[0];
                dataToSend.classification = topResult ? { category: topResult.categoryName.replace(/_/g, ' '), score: topResult.score } : {};
            }
            if (this.aiRequirements.needsObjectDetection) {
                dataToSend.objects = results.objectDetector?.detections?.map(d => ({ label: d.categories[0].categoryName, score: d.categories[0].score, x: d.boundingBox.originX, y: d.boundingBox.originY, width: d.boundingBox.width, height: d.boundingBox.height })) || [];
            }

            if (this.aiRequirements.needsCustomModel) {
                const topResult = results.customModel?.[0];
                dataToSend.classification = topResult ? { category: topResult.className, score: topResult.probability } : {};
            }

            if (this.aiRequirements.needsCustomModel) {
                const topResult = results.customModel?.[0];
                dataToSend.classification = topResult ? { category: topResult.className, score: topResult.probability } : {};
            }

            if (Object.keys(dataToSend).length > 0) {
                const currentJson = JSON.stringify(dataToSend);
                if (currentJson !== this.lastAiDataJson) {
                    this.lastAiDataJson = currentJson; 
                    this.lastAiSendTime = now;
                    try {
                        await this.commManager.sendData(currentJson + '\n');
                    } catch (e) {
                        this.lastAiDataJson = ''; 
                    }
                }
            }
        }
    }
    
    // --- HELPERS AND INITIALIZERS ---

    analyzeAiBlockUsage(workspace) {
        this.aiRequirements = { needsFaceCount: false, needsBlendshapes: false, needsHands: false, needsGestures: false, needsClassification: false, needsObjectDetection: false };
        if (!workspace) return;
        const allBlocks = workspace.getAllBlocks(false);
        for (const block of allBlocks) {
            switch (block.type) {
                case 'face_landmark_enable': if (block.getFieldValue('STATE') === 'ON') { this.aiRequirements.needsFaceCount = true; this.aiRequirements.needsBlendshapes = true; } break;
                case 'face_landmark_on_face_data':
                    this.aiRequirements.needsFaceCount = true;
                    if (block.getFieldValue('EXPRESSION') !== 'ANY_FACE') { this.aiRequirements.needsBlendshapes = true; }
                    break;
                case 'face_landmark_get_face_count': this.aiRequirements.needsFaceCount = true; break;
                case 'face_landmark_is_expression': this.aiRequirements.needsBlendshapes = true; this.aiRequirements.needsFaceCount = true; break;
                case 'face_landmark_get_blendshape_value': this.aiRequirements.needsBlendshapes = true; this.aiRequirements.needsFaceCount = true; break;
                case 'hand_gesture_enable': if (block.getFieldValue('STATE') === 'ON') { this.aiRequirements.needsHands = true; this.aiRequirements.needsGestures = true; } break;
                case 'hand_gesture_on_gesture': this.aiRequirements.needsGestures = true; this.aiRequirements.needsHands = true; break;
                case 'hand_gesture_get_hand_count': case 'hand_gesture_is_hand_present': this.aiRequirements.needsHands = true; break;
                case 'image_classification_enable': if (block.getFieldValue('STATE') === 'ON') this.aiRequirements.needsClassification = true; break;
                case 'image_classification_on_class': this.aiRequirements.needsClassification = true; break;
                case 'image_classification_get_class': case 'image_classification_is_class': this.aiRequirements.needsClassification = true; break;
                case 'object_detection_enable': if (block.getFieldValue('STATE') === 'ON') this.aiRequirements.needsObjectDetection = true; break;
                case 'object_detection_on_object': this.aiRequirements.needsObjectDetection = true; break;
                case 'object_detection_is_object_detected': case 'object_detection_for_each': this.aiRequirements.needsObjectDetection = true; break;
                case 'custom_model_setup':this.aiRequirements.needsCustomModel = true; break;case 'custom_model_when_class': case 'custom_model_is_class':this.aiRequirements.needsCustomModel = true;break;
            }
        }
    }

    async updateAiModelsBasedOnRequirements() {
        if (!this.isBlocksRequestingAi) return;
        const needsFaceModel = this.aiRequirements.needsFaceCount || this.aiRequirements.needsBlendshapes;
        if (needsFaceModel) {
            if (this.isFaceLandmarkerInitializedWithBlendshapes !== this.aiRequirements.needsBlendshapes) {
                await this.initFaceLandmarker(this.aiRequirements.needsBlendshapes);
            }
        }
    }

    async turnCameraOn() {
        if (this.isCameraOn) return;
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            this.ui.sidebarWebcam.srcObject = this.mediaStream;
            await new Promise(resolve => { this.ui.sidebarWebcam.onloadedmetadata = resolve; });
            this.ui.sidebarCanvas.width = this.ui.sidebarWebcam.videoWidth;
            this.ui.sidebarCanvas.height = this.ui.sidebarWebcam.videoHeight;
            this.ui.aiMonitorCanvas.width = this.ui.sidebarWebcam.videoWidth;
            this.ui.aiMonitorCanvas.height = this.ui.sidebarWebcam.videoHeight;
            this.ui.boardViewerContainer.classList.add('camera-active');
            this.isCameraOn = true;
        } catch (err) {
            this.ide.addConsoleMessage("Could not access camera: " + err.message, 'error');
            this.mediaStream = null;
        }
    }
    
    _turnCameraOff() {
        if (!this.isCameraOn || !this.mediaStream) return;
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
        this.ui.sidebarWebcam.srcObject = null;
        this.sidebarCanvasCtx.clearRect(0, 0, this.ui.sidebarCanvas.width, this.ui.sidebarCanvas.height);
        this.aiMonitorCanvasCtx.clearRect(0, 0, this.ui.aiMonitorCanvas.width, this.ui.aiMonitorCanvas.height);
        this.ui.boardViewerContainer.classList.remove('camera-active');
        this.isCameraOn = false;
    }

    async initFaceLandmarker(withBlendshapes = false) {
        if (this.faceLandmarker && this.isFaceLandmarkerInitializedWithBlendshapes === withBlendshapes) return true;
        try {
            if (this.faceLandmarker) { await this.faceLandmarker.close(); this.faceLandmarker = null; }
            const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
            this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
                outputFaceBlendshapes: withBlendshapes, runningMode: "VIDEO", numFaces: 5 
            });
            this.isFaceLandmarkerInitializedWithBlendshapes = withBlendshapes;
            this.ide.addConsoleMessage(`AI Face model loaded (${withBlendshapes ? 'full' : 'lightweight'}).`, 'success');
            return true;
        } catch (e) {
            this.ide.addConsoleMessage("Error loading Face model: " + e.message, 'error'); console.error(e); return false;
        }
    }

    async initGestureRecognizer() {
        if (this.gestureRecognizer) return true;
        try {
            const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
            this.gestureRecognizer = await GestureRecognizer.createFromOptions(filesetResolver, {
                baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task", delegate: "GPU" },
                runningMode: "VIDEO", numHands: 2
            });
            this.ide.addConsoleMessage("AI Hand Gesture model loaded.", 'success'); return true;
        } catch (e) {
            this.ide.addConsoleMessage("Error loading Hand Gesture model: " + e.message, 'error'); console.error(e); return false;
        }
    }

    async initImageClassifier() {
        if (this.imageClassifier) return true;
        try {
            const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
            this.imageClassifier = await ImageClassifier.createFromOptions(filesetResolver, {
                baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/latest/efficientnet_lite0.tflite", delegate: "GPU" },
                runningMode: "VIDEO", maxResults: 1
            });
            this.ide.addConsoleMessage("AI Image Classification model loaded.", 'success'); return true;
        } catch (e) {
            this.ide.addConsoleMessage("Error loading Image Classification model: " + e.message, 'error'); console.error(e); return false;
        }
    }

    async initObjectDetector() {
        if (this.objectDetector) return true;
        try {
            const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
            this.objectDetector = await ObjectDetector.createFromOptions(filesetResolver, {
                baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/latest/efficientdet_lite0.tflite", delegate: "GPU" },
                runningMode: "VIDEO", scoreThreshold: 0.5,
            });
            this.ide.addConsoleMessage("AI Object Detection model loaded.", 'success'); return true;
        } catch (e) {
            this.ide.addConsoleMessage("Error loading Object Detection model: " + e.message, 'error'); console.error(e); return false;
        }
    }


    updateAiMonitorUI(results) {
        let content = '{\n';
        const parts = [];

        switch (this.activeMonitorModel) {
            case 'face':
                if (results.faceLandmarker?.faceLandmarks) {
                    parts.push(`  "face_count": ${results.faceLandmarker.faceLandmarks.length}`);
                    if (results.faceLandmarker.faceBlendshapes?.[0]) {
                        const blendshapes = results.faceLandmarker.faceBlendshapes[0].categories.map(c => `    "${c.categoryName}": ${c.score.toFixed(4)}`).join(',\n');
                        parts.push(`  "blendshapes": {\n${blendshapes}\n  }`);
                    }
                }
                break;
            case 'hand':
                if (results.gestureRecognizer?.landmarks) {
                    parts.push(`  "hand_count": ${results.gestureRecognizer.landmarks.length}`);
                    const gestures = results.gestureRecognizer.gestures.flat().map(g => `"${g.categoryName}"`).join(', ');
                    if (gestures) parts.push(`  "gestures": [${gestures}]`);
                }
                break;
            case 'classification':
                if (results.imageClassifier?.classifications?.[0]?.categories?.[0]) {
                    const topResult = results.imageClassifier.classifications[0].categories[0];
                    parts.push(`  "classification": {\n    "category": "${topResult.categoryName.replace(/_/g, ' ')}",\n    "score": ${topResult.score.toFixed(4)}\n  }`);
                }
                break;
            case 'detection':
                if (results.objectDetector?.detections) {
                    const detectedObjects = results.objectDetector.detections.map(d => `    {\n      "label": "${d.categories[0].categoryName}",\n      "score": ${d.categories[0].score.toFixed(4)}\n    }`).join(',\n');
                    if (detectedObjects) parts.push(`  "objects": [\n${detectedObjects}\n  ]`);
                }
                break;
            case 'custom':
                if (results.customModel) {
                    const predictions = results.customModel.map(p => `    {\n      "class": "${p.className}",\n      "score": ${p.probability.toFixed(4)}\n    }`).join(',\n');
                    if (predictions) parts.push(`  "predictions": [\n${predictions}\n  ]`);
                }
                break;
        }
        if (parts.length === 0) {
            if (this.activeMonitorModel) {
                const modelName = this.activeMonitorModel.charAt(0).toUpperCase() + this.activeMonitorModel.slice(1);
                this.ui.aiMonitorDataOutput.innerHTML = `<p class="ai-monitor-placeholder">No data from ${modelName} model.\nMake sure objects are visible to the camera.</p>`;
            } else {
                this.ui.aiMonitorDataOutput.innerHTML = `<p class="ai-monitor-placeholder">Select a model above to view its live data.</p>`;
            }
            return;
        }
        content += parts.join(',\n') + '\n}';
        this.ui.aiMonitorDataOutput.textContent = content;
    }

    handleAiCameraBlock(block) {
        this.updateAiStateFromBlocks();
    }    

    async executeAiCommandFromBoard(line) {
        const parts = line.split(':');
        if (parts.length < 2) return;
        const command = parts[1];
        
        switch (command) {
            case 'toggle_camera':
                await this.handleCameraToggle();
                break;
            case 'camera_on':
                if (!this.isAiVisionRunning) {
                    await this.startAiVision(true); // Start in monitoring mode
                }
                break;
            case 'camera_off':
                if (this.isAiVisionRunning) {
                    this.stopAiVision();
                }
                break;
            case 'monitor_face':
                await this.toggleAiMonitorModal(true);
                document.querySelector('.ai-monitor-toggle[data-model="face"]').click();
                break;
            case 'monitor_hand':
                await this.toggleAiMonitorModal(true);
                document.querySelector('.ai-monitor-toggle[data-model="hand"]').click();
                break;
            case 'monitor_detection':
                await this.toggleAiMonitorModal(true);
                document.querySelector('.ai-monitor-toggle[data-model="detection"]').click();
                break;
            case 'monitor_classification':
                await this.toggleAiMonitorModal(true);
                document.querySelector('.ai-monitor-toggle[data-model="classification"]').click();
                break;            
            case 'monitor_stop':
                // Closes the monitor but keeps the camera running if it was started by a block
                await this.toggleAiMonitorModal(false);
                break;
            default:
                this.addConsoleMessage(`Unknown AI Command: ${command}`, 'error');
                break;
        }
    }

    
}