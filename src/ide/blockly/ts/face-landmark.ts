// src/renderer/blockly/face-landmark.ts

// --- Step 1: Import necessary modules ---
import * as Blockly from 'blockly/core';
import { PythonGenerator } from 'blockly/python';

// --- Step 2: Define Constants and Block JSON ---
const FACE_LANDMARK_BLOCK_STYLE = 'face_landmark_blocks';

Blockly.defineBlocksWithJsonArray([
    {
        "type": "face_landmark_enable",
        "message0": "enable face detection %1",
        "args0": [{ "type": "field_dropdown", "name": "STATE", "options": [["ON", "ON"], ["OFF", "OFF"]] }],
        "previousStatement": null,
        "nextStatement": null,
        "style": FACE_LANDMARK_BLOCK_STYLE,
        "tooltip": "Turns the camera and face detection model on or off in the browser."
    },
    {
        "type": "face_landmark_on_face_data",
        "message0": "when face is detected",
        "message1": "%1",
        "args1": [{ "type": "input_statement", "name": "DO" }],
        "style": FACE_LANDMARK_BLOCK_STYLE,
        "tooltip": "Runs code inside whenever at least one face is detected."
    },
    {
        "type": "face_landmark_get_face_count",
        "message0": "number of faces",
        "output": "Number",
        "style": FACE_LANDMARK_BLOCK_STYLE,
        "tooltip": "Gets the total number of faces currently detected."
    },
    {
        "type": "face_landmark_is_expression",
        "message0": "is face %1 ?",
        "args0": [{
            "type": "field_dropdown",
            "name": "EXPRESSION",
            "options": [
                ["smiling", "SMILING"],
                ["jaw open", "JAW_OPEN"],
                ["left eye closed (wink)", "LEFT_EYE_CLOSED"],
                ["right eye closed (wink)", "RIGHT_EYE_CLOSED"],
                ["puckering mouth", "PUCKERING"]
            ]
        }],
        "output": "Boolean",
        "style": FACE_LANDMARK_BLOCK_STYLE,
        "tooltip": "Checks if the first detected face is making a specific expression."
    }
]);


// --- Step 3: Define and Export the Generator Functions ---

/**
 * Export a function to register the Python generator functions for this block.
 * @param {PythonGenerator} generator The Python generator instance.
 */
export function registerFaceLandmarkGenerators(generator: PythonGenerator) {

    generator.forBlock['face_landmark_enable'] = function(block) {
        return '# UI: Face detection enabled/disabled in browser.\n';
    };

    generator.forBlock['face_landmark_on_face_data'] = function(block, gen) {
        const statements_do = gen.statementToCode(block, 'DO') || gen.INDENT + 'pass';
        const functionName = gen.nameDB_.getDistinctName('on_face_event', 'PROCEDURE');
        
        const func = `def ${functionName}():\n    if ai_data.get('face_count', 0) > 0:\n${statements_do}`;
        (gen as any).functionNames_[functionName] = func;
        
        if (!(gen as any).aiEventHandlers) {
            (gen as any).aiEventHandlers = new Set();
        }
        (gen as any).aiEventHandlers.add(functionName);

        return ''; // This is a hat block, it doesn't generate code in-line.
    };

    generator.forBlock['face_landmark_get_face_count'] = function(block, gen) {
        return [`ai_data.get('face_count', 0)`, gen.ORDER_FUNCTION_CALL];
    };

    generator.forBlock['face_landmark_is_expression'] = function(block, gen) {
        const expression = block.getFieldValue('EXPRESSION');
        const blendshapes = "ai_data.get('blendshapes', {})";
        let code = 'False';
        switch (expression) {
            case 'SMILING': code = `((${blendshapes}.get('mouthSmileLeft', 0.0) + ${blendshapes}.get('mouthSmileRight', 0.0)) / 2) > 0.5`; break;
            case 'JAW_OPEN': code = `${blendshapes}.get('jawOpen', 0.0) > 0.25`; break;
            case 'LEFT_EYE_CLOSED': code = `${blendshapes}.get('eyeBlinkLeft', 0.0) > 0.6`; break;
            case 'RIGHT_EYE_CLOSED': code = `${blendshapes}.get('eyeBlinkRight', 0.0) > 0.6`; break;
            case 'PUCKERING': code = `${blendshapes}.get('mouthPucker', 0.0) > 0.5`; break;
        }
        return [code, gen.ORDER_RELATIONAL];
    };

}