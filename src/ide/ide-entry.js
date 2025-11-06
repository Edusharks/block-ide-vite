// src/ide/ide-entry.js

import './ide.css';
import 'shepherd.js/dist/css/shepherd.css';

import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

import * as Blockly from 'blockly';
import { installAllBlocks as installColourBlocks } from '@blockly/field-colour';
import '@blockly/field-colour-hsv-sliders'; 
import { registerFieldAngle } from '@blockly/field-angle';
import { registerFieldMultilineInput, textMultiline } from '@blockly/field-multilineinput';
import '@blockly/field-bitmap';             
import '@blockly/field-date';               
import '@blockly/field-slider';             
import '@blockly/field-grid-dropdown';      
import '@blockly/field-dependent-dropdown'; 
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import 'blockly/msg/en';
import { applyTheme } from '../shared/theme-loader.js';
import { ESP32BlockIDE } from './ide.js';
import '@blockly/toolbox-search';
import { registerBasicBlocks } from './blockly/basic-blocks.js';
import { registerBasicGenerators } from './blockly/basic-generators.js';
import { registerEsp32Blocks } from './blockly/esp32-blocks.js';
import { registerEsp32Generators } from './blockly/esp32-generators.js';
import { registerPicoBlocks } from './blockly/pico-blocks.js';
import { registerPicoGenerators } from './blockly/pico-generators.js';
import { registerFaceLandmarkBlocks } from './blockly/face-landmark-blocks.js';
import { registerFaceLandmarkGenerators } from './blockly/face-landmark-generators.js';
import { registerHandGestureBlocks } from './blockly/hand-gesture-blocks.js';
import { registerHandGestureGenerators } from './blockly/hand-gesture-generators.js';
import { registerImageClassificationBlocks } from './blockly/image-classification-blocks.js';
import { registerImageClassificationGenerators } from './blockly/image-classification-generators.js';
import { registerObjectDetectionBlocks } from './blockly/object-detection-blocks.js';
import { registerObjectDetectionGenerators } from './blockly/object-detection-generators.js';
import { registerCustomModelBlocks } from './blockly/custom-model-blocks.js';
import { registerCustomModelGenerators } from './blockly/custom-model-generators.js';
import { initializeBlockly } from './blockly/blockly-init.js';

// This function assigns YOUR style names to the STANDARD Blockly blocks.
function applyBlockStyles() {
    ['controls_if', 'controls_repeat_ext', 'controls_whileUntil', 'controls_for', 'controls_forEach', 'controls_flow_statements'].forEach(b => {
        if (Blockly.Blocks[b]) Blockly.Blocks[b].style = 'loops_blocks';
    });
    ['logic_compare', 'logic_operation', 'logic_negate', 'logic_boolean'].forEach(b => {
        if (Blockly.Blocks[b]) Blockly.Blocks[b].style = 'logic_blocks';
    });
    ['math_number', 'math_arithmetic', 'math_single', 'math_modulo', 'math_constrain', 'math_random_int', 'math_constant', 'math_on_list'].forEach(b => {
        if (Blockly.Blocks[b]) Blockly.Blocks[b].style = 'math_blocks';
    });
    ['text', 'text_join', 'text_length', 'text_isEmpty', 'text_indexOf', 'text_charAt', 'text_getSubstring'].forEach(b => {
        if(Blockly.Blocks[b]) Blockly.Blocks[b].style = 'text_blocks';
    });
    ['lists_create_with', 'lists_length', 'lists_isEmpty', 'lists_indexOf', 'lists_getIndex', 'lists_setIndex', 'lists_getSublist'].forEach(b => {
        if (Blockly.Blocks[b]) Blockly.Blocks[b].style = 'lists_blocks';
    });
    if (Blockly.Blocks['variables_set']) Blockly.Blocks['variables_set'].style = 'variable_blocks';
    if (Blockly.Blocks['variables_get']) Blockly.Blocks['variables_get'].style = 'variable_blocks';
    if (Blockly.Blocks['math_change']) Blockly.Blocks['math_change'].style = 'variable_blocks';
}

// --- Phase 3: Define the main application startup logic ---
async function main() {
    applyTheme();
    installColourBlocks({
        python: pythonGenerator,
    });
    registerFieldAngle();
    registerFieldMultilineInput();
    textMultiline.installBlock({
        python: pythonGenerator,
    });
    
    registerBasicBlocks();
    applyBlockStyles();
    
    registerFaceLandmarkBlocks();
    registerHandGestureBlocks();
    registerImageClassificationBlocks();
    registerObjectDetectionBlocks();
    registerCustomModelBlocks();

    registerBasicGenerators(pythonGenerator);
    registerFaceLandmarkGenerators(pythonGenerator);
    registerHandGestureGenerators(pythonGenerator);
    registerImageClassificationGenerators(pythonGenerator);
    registerObjectDetectionGenerators(pythonGenerator);
    registerCustomModelGenerators(pythonGenerator);
    
    const params = new URLSearchParams(window.location.search);
    const boardId = params.get('board') || 'esp32';
    if (boardId === 'esp32') {
        registerEsp32Blocks();
        registerEsp32Generators(pythonGenerator);
    } else {
        registerPicoBlocks();
        registerPicoGenerators(pythonGenerator);
    }
    
    // -- WRAP THE GENERATOR FOR BLOCK IDs (Unchanged) --
    const originalBlockToCode = pythonGenerator.blockToCode;
    pythonGenerator.blockToCode = function(block, ...args) {
        if (block && block.id) {
            const code = originalBlockToCode.call(this, block, ...args);
            if (!Array.isArray(code) && typeof code === 'string' && code.includes('\n')) {
                 return `# block_id=${block.id}\n${code}`;
            }
            return code;
        }
        return originalBlockToCode.call(this, block, ...args);
    };
    
    // -- START THE MAIN APPLICATION --
    const projectName = params.get('project');
    const sharedData = params.get('project_data');

    if (boardId && (projectName || sharedData)) {
        const initialName = projectName || 'Shared Project';
        
        initializeBlockly(boardId, pythonGenerator);

        const ide = await ESP32BlockIDE.create(boardId, initialName, pythonGenerator);
        
        if (window.blockyManagerInstance) {
            ide.setBlocklyManager(window.blockyManagerInstance);
        } else {
            console.error("FATAL: Blockly manager instance was not created.");
            return;
        }

        window.ide = ide;

        window.addEventListener('storage', (event) => {
            if (event.key === 'blockIdeTheme') {
                applyTheme();
                if (window.ide) {
                    window.ide.updateEditorTheme();
                }
            }
        });

    } else {
        document.body.innerHTML = '<h1>Error: Project information or Board ID is missing.</h1><a href="index.html">Go back to projects</a>';
    }
}

document.addEventListener('DOMContentLoaded', main);