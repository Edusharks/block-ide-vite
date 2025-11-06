// src/ide/blockly/custom-model-blocks.js (FINALIZED)

import * as Blockly from 'blockly/core';

export function registerCustomModelBlocks() {
'use strict';

const CUSTOM_MODEL_BLOCK_STYLE = 'image_classification_blocks';

/**
 * A custom field that renders a button on the block.
 * It shows/hides itself based on the value of a connected input block.
 */
class FieldButton extends Blockly.Field {
    constructor(options) {
        super(Blockly.Field.SKIP_SETUP);
        this.name = options.name;
        this.text_ = options.text;
        this.onClick_ = options.onClick;
        this.class_ = options.class || 'blockly-button';
        this.SERIALIZABLE = true; // Fixes the serialization warning
    }

    static fromJson(options) {
        return new FieldButton(options);
    }

    initView() {
        this.buttonElement_ = Blockly.utils.dom.createSvgElement('g', {}, this.sourceBlock_.getSvgRoot());
        this.foreignObject_ = Blockly.utils.dom.createSvgElement('foreignObject', { 'width': 120, 'height': 30 }, this.buttonElement_);
        this.button_ = document.createElement('button');
        this.button_.setAttribute('class', this.class_);
        this.button_.innerText = this.text_;
        this.foreignObject_.appendChild(this.button_);

        // Add CSS to the document head for the button styles, ensuring it's only added once.
        const styleId = 'blockly-button-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .blockly-button {
                    padding: 6px 12px; border-radius: 8px; font-family: 'Inter', sans-serif;
                    font-weight: 600; font-size: 13px; background-color: #fff;
                    color: #6366f1; border: 1.5px solid #6366f1; cursor: pointer;
                    transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .blockly-button:hover {
                    background-color: #6366f1; color: #fff; transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
                }
            `;
            document.head.appendChild(style);
        }
    }

    render_() {
        if (!this.buttonElement_) return;

        let hasValidUrl = false;
        const urlInput = this.sourceBlock_.getInput('URL');
        if (urlInput && urlInput.connection && urlInput.connection.targetBlock()) {
            const targetBlock = urlInput.connection.targetBlock();
            if (targetBlock.type === 'text') {
                const urlValue = targetBlock.getFieldValue('TEXT');
                if (urlValue && urlValue.startsWith('https://teachablemachine.withgoogle.com/models/')) {
                    hasValidUrl = true;
                }
            }
        }

        this.buttonElement_.style.display = hasValidUrl ? 'block' : 'none';

        if (hasValidUrl) {
            const size = this.sourceBlock_.getHeightWidth();
            this.foreignObject_.setAttribute('y', size.height - 35);
            this.foreignObject_.setAttribute('x', 10);
        }
    }

    bindEvents_() {
        super.bindEvents_();
        Blockly.browserEvents.bind(this.button_, 'mousedown', this, (e) => {
            e.stopPropagation();
        });
        Blockly.browserEvents.bind(this.button_, 'click', this, this.onButtonClick_);
    }

    onButtonClick_() {
        if (typeof this.onClick_ === 'function') {
            this.onClick_(this.sourceBlock_);
        }
    }
}
Blockly.fieldRegistry.register('field_button', FieldButton);


/**
 * This function is the dynamic provider for the class name dropdowns.
 * It will be called by Blockly whenever it needs to render the dropdown options.
 */
const customModelClassProvider = function() {
    // Access the labels via the global `window.ide` object, which fits the app's architecture.
    if (window.ide && window.ide.aiManager && window.ide.aiManager.customModelLabels.length > 0) {
        // If labels exist, map them to the format Blockly needs: [['displayText', 'VALUE'], ...]
        return window.ide.aiManager.customModelLabels.map(label => [label, label]);
    }
    // If no model is loaded yet, provide a default placeholder option.
    return [['(no model loaded)', 'NONE']];
};


// Define the blocks using the dynamic function provider for dropdowns.
Blockly.defineBlocksWithJsonArray([
    {
        "type": "custom_model_setup",
        "message0": "setup custom model from URL %1",
        "args0": [
            { "type": "input_value", "name": "URL", "check": "String", "align": "RIGHT" }
        ],
        "message1": "%1",
        "args1": [
            {
                "type": "field_button",
                "name": "TEST_BUTTON",
                "text": "Load Model", // <-- 1. TEXT CHANGED HERE
                "onClick": (block) => {
                    const urlInput = block.getInput('URL');
                    if (urlInput && urlInput.connection && urlInput.connection.targetBlock()) {
                        const url = urlInput.connection.targetBlock().getFieldValue('TEXT');
                        if (window.ide && typeof window.ide.handleTestCustomModel === 'function') {
                            window.ide.handleTestCustomModel(url);
                        }
                    }
                }
            }
        ],
        "previousStatement": null,
        "nextStatement": null,
        "style": CUSTOM_MODEL_BLOCK_STYLE,
        "tooltip": "Loads a custom image classification model from a Teachable Machine URL.",
        "helpUrl": "",
        "inputsInline": false,
        "onchange": function(event) {
            if (
                event.blockId === this.id ||
                (event.type === Blockly.Events.BLOCK_CHANGE && this.getInput('URL')?.connection?.targetBlock()?.id === event.blockId) ||
                (event.type === Blockly.Events.BLOCK_MOVE && (event.newInputName === 'URL' || event.oldInputName === 'URL') && (event.newParentId === this.id || event.oldParentId === this.id))
            ) {
                this.getField('TEST_BUTTON')?.render_();
            }
        }
    },
    {
        "type": "custom_model_when_class",
        "message0": "when custom model detects %1",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "CLASS_NAME",
                "options": customModelClassProvider // Using the function provider
            }
        ],
        "message1": "%1",
        "args1": [
            {
                "type": "input_statement",
                "name": "DO"
            }
        ],
        "style": CUSTOM_MODEL_BLOCK_STYLE,
        "tooltip": "Runs code when the loaded custom model detects a specific class."
    },
    {
        "type": "custom_model_is_class",
        "message0": "is custom model detecting %1 ?",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "CLASS_NAME",
                "options": customModelClassProvider // Using the function provider
            }
        ],
        "output": "Boolean",
        "style": CUSTOM_MODEL_BLOCK_STYLE,
        "tooltip": "Checks if the currently detected class matches the selected one."
    }
]);

FieldButton.prototype.render_ = function() {
    if (!this.buttonElement_) return;

    let showButton = false;
    const urlInput = this.sourceBlock_.getInput('URL');
    
    if (urlInput && urlInput.connection && urlInput.connection.targetBlock()) {
        const targetBlock = urlInput.connection.targetBlock();
        if (targetBlock.type === 'text') {
            const urlValue = targetBlock.getFieldValue('TEXT');
            const isValidUrl = urlValue && urlValue.startsWith('https://teachablemachine.withgoogle.com/models/');
            
            // Check the global state to see if this specific model is already loaded.
            const isModelLoaded = window.ide?.aiManager?.isCustomModelLoadedFor(urlValue);

            // Show the button ONLY if the URL is valid AND the model is NOT yet loaded.
            if (isValidUrl && !isModelLoaded) {
                showButton = true;
            }
        }
    }

    this.buttonElement_.style.display = showButton ? 'block' : 'none';

    if (showButton) {
        const size = this.sourceBlock_.getHeightWidth();
        this.foreignObject_.setAttribute('y', size.height - 35);
        this.foreignObject_.setAttribute('x', 10);
    }
};

}