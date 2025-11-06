// src/renderer/blockly/hand-gesture.ts

// --- Step 1: Import necessary modules ---
import * as Blockly from 'blockly/core';
import { PythonGenerator } from 'blockly/python';

// --- Step 2: Define Constants and Block JSON ---
const HAND_GESTURE_BLOCK_STYLE = 'hand_gesture_blocks';

const GESTURE_OPTIONS = [
    ["👍 Thumbs Up", "Thumb_Up"],
    ["👎 Thumbs Down", "Thumb_Down"],
    ["✊ Closed Fist", "Closed_Fist"],
    ["✋ Open Palm", "Open_Palm"],
    ["👆 Pointing Up", "Pointing_Up"],
    ["✌️ Victory", "Victory"],
    ["🤟 I Love You", "ILoveYou"]
];

// This call runs automatically when the file is imported.
Blockly.defineBlocksWithJsonArray([
    {
        "type": "hand_gesture_enable",
        "message0": "enable hand tracking %1",
        "args0": [{ "type": "field_dropdown", "name": "STATE", "options": [["ON", "ON"], ["OFF", "OFF"]] }],
        "previousStatement": null,
        "nextStatement": null,
        "style": HAND_GESTURE_BLOCK_STYLE,
        "tooltip": "Turns the camera and hand gesture model on or off in the browser."
    },
    {
        "type": "hand_gesture_on_gesture",
        "message0": "when hand gesture %1 is detected",
        "args0": [{ "type": "field_dropdown", "name": "GESTURE", "options": GESTURE_OPTIONS }],
        "message1": "%1",
        "args1": [{ "type": "input_statement", "name": "DO" }],
        "style": HAND_GESTURE_BLOCK_STYLE,
        "tooltip": "Runs code when a specific hand gesture is seen by the camera."
    },
    {
        "type": "hand_gesture_get_hand_count",
        "message0": "number of hands",
        "output": "Number",
        "style": HAND_GESTURE_BLOCK_STYLE,
        "tooltip": "Gets the total number of hands detected in the camera view."
    },
    {
        "type": "hand_gesture_is_hand_present",
        "message0": "is a %1 hand detected?",
        "args0": [{
            "type": "field_dropdown",
            "name": "HANDEDNESS",
            "options": [["left", "Left"], ["right", "Right"], ["any", "Any"]]
        }],
        "output": "Boolean",
        "style": HAND_GESTURE_BLOCK_STYLE,
        "tooltip": "Checks if a specific hand (or any hand) is visible."
    }
]);

// --- Step 3: Define and Export the Generator Functions ---

/**
 * Export a function to register the Python generator functions for the hand gesture blocks.
 * @param {PythonGenerator} generator The Python generator instance.
 */
export function registerHandGestureGenerators(generator: PythonGenerator) {
    
    generator.forBlock['hand_gesture_enable'] = function(block) {
        // The ensureAiDataProcessor() call should be handled in a central generator file.
        return '# UI: Hand tracking enabled/disabled in browser.\n';
    };

    generator.forBlock['hand_gesture_on_gesture'] = function(block, gen) {
        const gesture = block.getFieldValue('GESTURE');
        const statements_do = gen.statementToCode(block, 'DO') || gen.INDENT + 'pass';
        const functionName = gen.nameDB_.getDistinctName(`on_gesture_${gesture}`, 'PROCEDURE');
        
        const func = `def ${functionName}():\n    if '${gesture}' in ai_data.get('gestures', []):\n${statements_do}`;
        gen.functionNames_[functionName] = func;

        // Ensure the global handler set exists before adding to it
        if (!(gen as any).aiEventHandlers) {
            (gen as any).aiEventHandlers = new Set();
        }
        (gen as any).aiEventHandlers.add(functionName);
        
        return ''; // Hat block
    };

    generator.forBlock['hand_gesture_get_hand_count'] = function(block, gen) {
        return [`ai_data.get('hand_count', 0)`, gen.ORDER_FUNCTION_CALL];
    };

    generator.forBlock['hand_gesture_is_hand_present'] = function(block, gen) {
        const handedness = block.getFieldValue('HANDEDNESS');
        const hands_list = "ai_data.get('hands', [])";
        const code = (handedness === 'Any') ? `len(${hands_list}) > 0` : `'${handedness}' in ${hands_list}`;
        return [code, gen.ORDER_RELATIONAL];
    };
}