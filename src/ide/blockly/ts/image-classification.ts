// src/renderer/blockly/image-classification.ts

// --- Step 1: Import necessary modules ---
import * as Blockly from 'blockly/core';
import { PythonGenerator } from 'blockly/python';

// --- Step 2: Define Constants and Block JSON ---
const IMAGE_CLASSIFICATION_BLOCK_STYLE = 'image_classification_blocks';

const CLASSIFICATION_CLASSES = [
    ["Apple", "apple"], ["Backpack", "backpack"], ["Banana", "banana"], ["Baseball bat", "baseball bat"],
    ["Bear", "bear"], ["Bed", "bed"], ["Bicycle", "bicycle"], ["Bird", "bird"], ["Book", "book"],
    ["Bottle", "bottle"], ["Bowl", "bowl"], ["Bus", "bus"], ["Car", "car"], ["Cat", "cat"],
    ["Cell phone", "cell phone"], ["Chair", "chair"], ["Clock", "clock"], ["Computer", "computer"],
    ["Cup", "cup"], ["Dog", "dog"], ["Donut", "donut"], ["Elephant", "elephant"], ["Fork", "fork"],
    ["Hot dog", "hot dog"], ["Keyboard", "keyboard"], ["Kite", "kite"], ["Knife", "knife"],
    ["Laptop", "laptop"], ["Microwave", "microwave"], ["Motorcycle", "motorcycle"], ["Mouse", "mouse"],
    ["Orange", "orange"], ["Oven", "oven"], ["Parking meter", "parking meter"], ["Person", "person"],
    ["Pizza", "pizza"], ["Potted plant", "potted plant"], ["Refrigerator", "refrigerator"],
    ["Remote", "remote"], ["Sandwich", "sandwich"], ["Scissors", "scissors"], ["Sink", "sink"],
    ["Spoon", "spoon"], ["Sports ball", "sports ball"], ["Stop sign", "stop sign"], ["Suitcase", "suitcase"],
    ["Teddy bear", "teddy bear"], ["Television", "tv"], ["Toaster", "toaster"], ["Toilet", "toilet"],
    ["Toothbrush", "toothbrush"], ["Traffic light", "traffic light"], ["Train", "train"],
    ["Truck", "truck"], ["Umbrella", "umbrella"], ["Vase", "vase"], ["Wine glass", "wine glass"],
    ["Zebra", "zebra"]
];

// This call runs automatically when the file is imported, defining the blocks.
Blockly.defineBlocksWithJsonArray([
    {
        "type": "image_classification_enable",
        "message0": "enable image classification %1",
        "args0": [{ "type": "field_dropdown", "name": "STATE", "options": [["ON", "ON"], ["OFF", "OFF"]] }],
        "previousStatement": null,
        "nextStatement": null,
        "style": IMAGE_CLASSIFICATION_BLOCK_STYLE,
        "tooltip": "Turns the camera and image classification model on or off in the browser."
    },
    {
        "type": "image_classification_is_class",
        "message0": "is image classified as %1 ?",
        "args0": [{ "type": "field_dropdown", "name": "CLASS", "options": CLASSIFICATION_CLASSES }],
        "output": "Boolean",
        "style": IMAGE_CLASSIFICATION_BLOCK_STYLE,
        "tooltip": "Checks if the main subject of the camera view is a specific class."
    },
    {
        "type": "image_classification_get_class",
        "message0": "get image classification",
        "output": "String",
        "style": IMAGE_CLASSIFICATION_BLOCK_STYLE,
        "tooltip": "Gets the name of the main subject detected by the camera."
    }
]);

// --- Step 3: Define and Export the Generator Functions ---

/**
 * Export a function to register the Python generator functions for this block.
 * @param {PythonGenerator} generator The Python generator instance.
 */
export function registerImageClassificationGenerators(generator: PythonGenerator) {

    // NOTE: The 'ensureAiDataProcessor()' call is removed. It's a shared utility
    // that should be defined and called once in your main 'basic-generators.js'
    // or 'basic.ts' file, not in every individual extension.

    generator.forBlock['image_classification_enable'] = function(block) {
        return '# UI: Image classification enabled/disabled in browser.\n';
    };

    generator.forBlock['image_classification_is_class'] = function(block, gen) {
        const objectClass = block.getFieldValue('CLASS');
        const code = `ai_data.get('classification', {}).get('category', '') == '${objectClass}'`;
        return [code, gen.ORDER_EQUALITY];
    };

    generator.forBlock['image_classification_get_class'] = function(block, gen) {
        const code = `ai_data.get('classification', {}).get('category', '')`;
        return [code, gen.ORDER_FUNCTION_CALL];
    };
}