// src/ide/blockly/blockly-init.js

import * as Blockly from 'blockly/core';

import { Backpack } from '@blockly/workspace-backpack';
// import { PositionedMinimap } from '@blockly/workspace-minimap';
import { CrossTabCopyPaste } from '@blockly/plugin-cross-tab-copy-paste';
import { ZoomToFitControl } from '@blockly/zoom-to-fit';
import {
    ScrollOptions,
    ScrollBlockDragger,
    ScrollMetricsManager,
} from '@blockly/plugin-scroll-options';


class CustomCategory extends Blockly.ToolboxCategory {
  constructor(categoryDef, toolbox, opt_parent) {
    super(categoryDef, toolbox, opt_parent);
  }

  setSelected(isSelected) {
    this.rowDiv_.classList.toggle('blocklyTreeSelected', isSelected);
  }

  addColourBorder_(colour) {
    this.rowDiv_.style.setProperty('--category-color', colour);
  }

  createDom_() {
    super.createDom_();
    this.rowDiv_.classList.add('blocklyTreeRow');
    
    return this.htmlDiv_;
  }
}

Blockly.registry.register(
  Blockly.registry.Type.TOOLBOX_ITEM,
  Blockly.ToolboxCategory.registrationName,
  CustomCategory, true);


export function initializeBlockly(boardId, generator) {

// ===== 1. THEME DEFINITION (CORRECTED AND COMPLETE) =====
    const Esp32IdeTheme = Blockly.Theme.defineTheme('esp32-ide-final', {
        'base': Blockly.Themes.Zelos, // Or Blockly.Themes.Classic if you are using the custom category CSS
        'blockStyles': {
            // --- Core Logic & Data ---
            'loops_blocks': { 'colourPrimary': '#ffc800' },      // Green
            'logic_blocks': { 'colourPrimary': '#EF4444' },      // Red
            'math_blocks': { 'colourPrimary': '#8B5CF6' },       // Violet
            'text_blocks': { 'colourPrimary': '#F97316' },       // Orange
            'lists_blocks': { 'colourPrimary': '#F43F5E' },      // Rose
            'colour_blocks': { 'colourPrimary': '#14B8A6' },     // Teal
            'variable_blocks': { 'colourPrimary': '#EC4899' },   // Pink
            'procedure_blocks': { 'colourPrimary': '#D946EF' },  // Fuchsia
            'wait_block_style': { 'colourPrimary': '#EAB308' },  // Gold

            // --- Hardware & Communication ---
            'gpio_blocks': { 'colourPrimary': '#0EA5E9' },       // Sky Blue
            'sensor_blocks': { 'colourPrimary': '#10B981' },     // Emerald
            'actuator_blocks': { 'colourPrimary': '#22C55E' },   // Amber
            'communication_blocks': { 'colourPrimary': '#6366F1' }, // Indigo
            
            // --- Extensions ---
            'display_blocks': { 'colourPrimary': '#4F46E5' },       // Deep Indigo
            'networking_blocks': { 'colourPrimary': '#16A34A' },    // Dark Green
            'bluetooth_blocks': { 'colourPrimary': '#3B82F6' },     // Standard Blue
            'face_landmark_blocks': { 'colourPrimary': '#7C3AED' }, // Bright Purple
            'hand_gesture_blocks': { 'colourPrimary': '#F59E0B' },   // Sunflower
            'image_classification_blocks': { 'colourPrimary': '#2DD4BF' }, // Turquoise
            'object_detection_blocks': { 'colourPrimary': '#0891B2' },   // Dark Cyan
        },
        'categoryStyles': {
            // --- These colors MUST match the blockStyles above ---
            'loops_category': { 'colour': '#ffc800' },
            'logic_category': { 'colour': '#EF4444' },
            'math_category': { 'colour': '#8B5CF6' },
            'text_category': { 'colour': '#F97316' },
            'lists_category': { 'colour': '#F43F5E' },
            'colour_category': { 'colour': '#14B8A6' },
            'variables_category': { 'colour': '#EC4899' },
            'functions_category': { 'colour': '#D946EF' },
            'gpio_category': { 'colour': '#0EA5E9' },
            'sensors_category': { 'colour': '#10B981' },
            'actuators_category': { 'colour': '#22C55E' },
            'communication_category': { 'colour': '#6366F1' },
            'display_category': { 'colour': '#4F46E5' },
            'networking_category': { 'colour': '#16A34A' },
            'bluetooth_category': { 'colour': '#3B82F6' },
            'face_landmark_category': { 'colour': '#7C3AED' },
            'hand_gesture_category': { 'colour': '#F59E0B' },
            'image_classification_category': { 'colour': '#2DD4BF' },
            'object_detection_category': { 'colour': '#0891B2' },
        },
        'componentStyles': {
            // Using CSS variables to link to your main theme
            'workspaceBackgroundColour': 'var(--bg-main)',
            'toolboxBackgroundColour': 'var(--bg-toolbox)',
            'flyoutBackgroundColour': 'var(--bg-flyout)',
            'scrollbarColour': 'var(--border-color)'
        },
        'fontStyle': {
            // Defining a consistent font for all Blockly text
            'family': "'Nunito', sans-serif",
            'weight': '600',
            'size': 12
        }
    });

    // ===== 2. TOOLBOX DEFINITIONS (Unchanged) =====
    function createBasicToolbox() {
        return {
            "kind": "categoryToolbox",
            "contents": [
                {
                    "kind": "search",
                    "name": "🔍 Search Blocks",
                    "contents": [],
                },
                {
                    "kind": "category", "name": "Loops", "categorystyle": "loops_category",
                    "contents": [
                        { "kind": "block", "type": "on_start" },
                        { "kind": "block", "type": "forever" },
                        { "kind": "block", "type": "every_x_ms" },
                        { "kind": "block", "type": "control_delay_seconds", "inputs": { "DELAY_SEC": { "shadow": { "type": "math_number", "fields": { "NUM": 1 } } } } },
                        { "kind": "block", "type": "controls_repeat_ext", "inputs": { "TIMES": { "shadow": { "type": "math_number", "fields": { "NUM": 4 } } } } },
                        { "kind": "block", "type": "controls_whileUntil" },
                        { "kind": "block", "type": "controls_for", "inputs": { "FROM": { "shadow": { "type": "math_number", "fields": { "NUM": 0 } } }, "TO": { "shadow": { "type": "math_number", "fields": { "NUM": 4 } } }, "BY": { "shadow": { "type": "math_number", "fields": { "NUM": 1 } } } } },
                        { "kind": "block", "type": "controls_forEach" },
                        { "kind": "block", "type": "controls_flow_statements" },
                        { "kind": "sep", "gap": "16" }, 
                        { "kind": "label", "text": "Async & Interrupts"},
                        { "kind": "block", "type": "async_run_main_loop" },
                        { "kind": "block", "type": "async_sleep_ms", "inputs": { "MS": { "shadow": { "type": "math_number", "fields": { "NUM": 100 } } } } }
                    ]
                },
                {
                    "kind": "category", "name": "Logic", "categorystyle": "logic_category",
                    "contents": [
                        { "kind": "block", "type": "controls_if" },
                        { "kind": "block", "type": "logic_compare" },
                        { "kind": "block", "type": "logic_operation" },
                        { "kind": "block", "type": "logic_negate" },
                        { "kind": "block", "type": "logic_boolean" },
                    ]
                },
                {
                    "kind": "category", "name": "Math", "categorystyle": "math_category",
                    "contents": [
                        { "kind": "block", "type": "math_number" },
                        { "kind": "block", "type": "math_arithmetic", "inputs": { "A": { "shadow": { "type": "math_number", "fields": { "NUM": 1 }}}, "B": { "shadow": { "type": "math_number", "fields": { "NUM": 1 }}}}},
                        { "kind": "block", "type": "math_single", "inputs": { "NUM": { "shadow": { "type": "math_number", "fields": { "NUM": 9 }}}}},
                        { "kind": "block", "type": "math_modulo", "inputs": { "DIVIDEND": { "shadow": { "type": "math_number", "fields": { "NUM": 64 }}}, "DIVISOR": { "shadow": { "type": "math_number", "fields": { "NUM": 10 }}}}},
                        { "kind": "block", "type": "math_constrain", "inputs": { "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": 50 }}}, "LOW": { "shadow": { "type": "math_number", "fields": { "NUM": 1 }}}, "HIGH": { "shadow": { "type": "math_number", "fields": { "NUM": 100 }}}}},
                        { "kind": "block", "type": "math_random_int", "inputs": { "FROM": { "shadow": { "type": "math_number", "fields": { "NUM": 1 }}}, "TO": { "shadow": { "type": "math_number", "fields": { "NUM": 100 }}}}},
                        { "kind": "block", "type": "math_constant" },
                        { "kind": "block", "type": "math_on_list" },
                        { "kind": "block", "type": "math_map", "inputs": { "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": 512 }}}, "FROM_LOW": { "shadow": { "type": "math_number", "fields": { "NUM": 0 }}}, "FROM_HIGH": { "shadow": { "type": "math_number", "fields": { "NUM": 1023 }}}, "TO_LOW": { "shadow": { "type": "math_number", "fields": { "NUM": 0 }}}, "TO_HIGH": { "shadow": { "type": "math_number", "fields": { "NUM": 100 }}}} },
                    ]
                },
                {
                    "kind": "category", "name": "Text", "categorystyle": "text_category",
                    "contents": [
                        { "kind": "block", "type": "text" },
                        { "kind": "block", "type": "text_multiline" },
                        { "kind": "block", "type": "text_join" },
                        { "kind": "block", "type": "text_length", "inputs": { "VALUE": { "shadow": { "type": "text", "fields": { "TEXT": "abc" } } } } },
                        { "kind": "block", "type": "text_isEmpty", "inputs": { "VALUE": { "shadow": { "type": "text", "fields": { "TEXT": "" } } } } },
                        { "kind": "block", "type": "text_indexOf", "inputs": { "VALUE": { "shadow": { "type": "text", "fields": { "TEXT": "hello world" } } }, "FIND": { "shadow": { "type": "text", "fields": { "TEXT": "world" } } } } },
                        { "kind": "block", "type": "text_charAt", "inputs": { "VALUE": { "shadow": { "type": "text", "fields": { "TEXT": "abc" } } } } },
                        { "kind": "block", "type": "text_getSubstring", "inputs": { "STRING": { "shadow": { "type": "text", "fields": { "TEXT": "hello world" } } } } },
                        { "kind": "block", "type": "text_parse_to_number", "inputs": { "TEXT": { "shadow": { "type": "text", "fields": { "TEXT": "123" } } } } },
                        { "kind": "block", "type": "text_convert_to_text", "inputs": { "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": 0 } } } } },
                        { "kind": "block", "type": "text_from_char_code", "inputs": { "CODE": { "shadow": { "type": "math_number", "fields": { "NUM": 65 } } } } },
                        { "kind": "block", "type": "text_char_code_at", "inputs": { "TEXT": { "shadow": { "type": "text", "fields": { "TEXT": "abc" } } }, "AT": { "shadow": { "type": "math_number", "fields": { "NUM": 0 } } } } },
                    ]
                },
                {
                    "kind": "category", "name": "Lists", "categorystyle": "lists_category",
                    "contents": [
                        { "kind": "block", "type": "lists_create_with" },
                        { "kind": "block", "type": "lists_length" },
                        { "kind": "block", "type": "lists_isEmpty" },
                        { "kind": "block", "type": "lists_indexOf" },
                        { "kind": "block", "type": "lists_getIndex" },
                        { "kind": "block", "type": "lists_setIndex" },
                        { "kind": "block", "type": "lists_getSublist" },
                        { "kind": "block", "type": "lists_get_random_item" },
                    ]
                },
                { "kind": "category", "name": "Variables", "categorystyle": "variables_category", "custom": "VARIABLE" },
                { "kind": "category", "name": "Functions", "categorystyle": "functions_category", "custom": "PROCEDURE" },
            ]
        };
    }
    
    function createEsp32Toolbox() {
        return {
            "contents": [
                { "kind": "sep" },
                {
                    "kind": "category", "name": "GPIO", "categorystyle": "gpio_category",
                    "contents": [
                        { "kind": "block", "type": "gpio_digital_write" },
                        { "kind": "block", "type": "gpio_digital_read" },
                        { "kind": "block", "type": "gpio_analog_read" },
                        { "kind": "block", "type": "gpio_pwm_write", "inputs": { "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": 512 } } } } },
                        { "kind": "block", "type": "gpio_on_pin_change" },
                    ]
                },
                {
                    "kind": "category", "name": "Sensors", "categorystyle": "sensors_category",
                    "contents": [
                        { "kind": "block", "type": "sensor_internal_temp" },
                        { "kind": "block", "type": "sensor_dht_measure" },
                        { "kind": "block", "type": "sensor_dht11" },
                        { "kind": "block", "type": "sensor_ultrasonic_hcsr04" },
                        { "kind": "block", "type": "sensor_pir_motion" },
                        { "kind": "block", "type": "sensor_limit_switch" },
                        { "kind": "block", "type": "sensor_analog_percent" },
                    ]
                },
                {
                    "kind": "category", "name": "Actuators", "categorystyle": "actuators_category",
                    "contents": [
                        { "kind": "block", "type": "actuator_onboard_led" },
                        { "kind": "block", "type": "actuator_led" },
                        { "kind": "block", "type": "actuator_led_toggle" },
                        { "kind": "block", "type": "actuator_buzzer_note", "inputs": { "DURATION": { "shadow": { "type": "math_number", "fields": { "NUM": 500 } } } } },
                        { "kind": "block", "type": "actuator_servo_positional" },
                        { "kind": "block", "type": "actuator_servo_continuous" },
                    ]
                },
                {
                    "kind": "category", "name": "Communication", "categorystyle": "communication_category",
                    "contents": [
                        { "kind": "block", "type": "usb_serial_println", "inputs": { "DATA": { "shadow": { "type": "text", "fields": { "TEXT": "Hello" } } } } },
                        { "kind": "block", "type": "usb_serial_print_value", "inputs": { "NAME": { "shadow": { "type": "text", "fields": { "TEXT": "Value" } } }, "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": 0 } } } } },
                        { "kind": "block", "type": "usb_serial_read_line" },
                        { "kind": "block", "type": "usb_serial_plot_value", "inputs": { "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": 0 } } }, "NAME": { "shadow": { "type": "text", "fields": { "TEXT": "Sensor" } } } } },
                        { "kind": "block", "type": "comm_send_ai_command", "inputs": { "PARAM": { "shadow": { "type": "text", "fields": { "TEXT": "" } } } } },
                    ]
                },
                
            ]
        };
    }
    
    function createPicoToolbox() {
        return {
            "contents": [
                { "kind": "sep" },
                {
                    "kind": "category", "name": "GPIO", "categorystyle": "gpio_category",
                    "contents": [
                        { "kind": "block", "type": "gpio_digital_write" },
                        { "kind": "block", "type": "gpio_digital_read" },
                        { "kind": "block", "type": "gpio_analog_read" },
                        { "kind": "block", "type": "gpio_pwm_write", "inputs": { "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": 32768 } } } } },
                        { "kind": "block", "type": "gpio_on_pin_change" },
                    ]
                },
                {
                    "kind": "category", "name": "Sensors", "categorystyle": "sensors_category",
                    "contents": [
                        { "kind": "block", "type": "sensor_internal_temp" },
                        { "kind": "block", "type": "sensor_dht_measure" },
                        { "kind": "block", "type": "sensor_dht11" },
                        { "kind": "block", "type": "sensor_ultrasonic_hcsr04" },
                        { "kind": "block", "type": "sensor_pir_motion" },
                        { "kind": "block", "type": "sensor_limit_switch" },
                        { "kind": "block", "type": "sensor_analog_percent" },
                    ]
                },
                {
                    "kind": "category", "name": "Actuators", "categorystyle": "actuators_category",
                    "contents": [
                        { "kind": "block", "type": "actuator_onboard_led" },
                        { "kind": "block", "type": "actuator_led" },
                        { "kind": "block", "type": "actuator_led_toggle" },
                        { "kind": "block", "type": "actuator_buzzer_note", "inputs": { "DURATION": { "shadow": { "type": "math_number", "fields": { "NUM": 500 } } } } },
                        { "kind": "block", "type": "actuator_servo_positional" },
                        { "kind": "block", "type": "actuator_servo_continuous" },
                    ]
                },
                {
                    "kind": "category", "name": "Communication", "categorystyle": "communication_category",
                    "contents": [
                        { "kind": "block", "type": "usb_serial_println", "inputs": { "DATA": { "shadow": { "type": "text", "fields": { "TEXT": "Hello" } } } } },
                        { "kind": "block", "type": "usb_serial_print_value", "inputs": { "NAME": { "shadow": { "type": "text", "fields": { "TEXT": "Value" } } }, "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": 0 } } } } },
                        { "kind": "block", "type": "usb_serial_read_line" },
                        { "kind": "block", "type": "usb_serial_plot_value", "inputs": { "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": 0 } } }, "NAME": { "shadow": { "type": "text", "fields": { "TEXT": "Sensor" } } } } },
                        { "kind": "block", "type": "comm_send_ai_command", "inputs": { "PARAM": { "shadow": { "type": "text", "fields": { "TEXT": "" } } } } },
                    ]
                },
                
            ]
        };
    }

    // ===== 3. WORKSPACE MANAGER CLASS (Unchanged) =====
    class BlocklyWorkspaceManager {
        constructor(boardId, generator) {
            this.boardId = boardId;
            this.workspace = null;
            this.generator = generator;
            this.toolbox = this.createToolbox();
        }

        createToolbox() {
            let finalToolbox = createBasicToolbox();
            if (this.boardId === 'esp32') {
                finalToolbox.contents.push(...createEsp32Toolbox().contents);
            } else if (this.boardId === 'pico') { 
                finalToolbox.contents.push(...createPicoToolbox().contents);
            }
            finalToolbox.contents.push(
                { "kind": "category", "name": "Add Extension", "categorystyle": "functions_category", "custom": "ADD_EXTENSION" }
            );
            return finalToolbox;
        }

        rebuildToolboxForCustomModel() {
        if (this.workspace) {
            this.workspace.updateToolbox(this.toolbox);
        }
    }


    rebuildAndApplyToolbox(loadedExtensionsSet, dynamicDashboardBlocks = []) {

        //console.log('[BlocklyManager] 3. rebuildAndApplyToolbox called.');
        let finalToolbox = this.createToolbox();

        const extensionCategories = {
            'face_landmark': { 
                "kind": "category", "name": "Face Landmark", "categorystyle": "face_landmark_category", 
                "contents": [
                    { "kind": "block", "type": "face_landmark_enable" },
                    { "kind": "block", "type": "face_landmark_on_face_data" },
                    { "kind": "block", "type": "face_landmark_get_face_count" },
                    { "kind": "block", "type": "face_landmark_is_expression" },
                    { "kind": "block", "type": "face_landmark_get_blendshape_value" } 
                ] 
            },
            'hand_gesture': { 
                "kind": "category", "name": "Hand Gesture", "categorystyle": "hand_gesture_category", 
                "contents": [
                    { "kind": "block", "type": "hand_gesture_enable" },
                    { "kind": "block", "type": "hand_gesture_on_gesture" },
                    { "kind": "block", "type": "hand_gesture_get_hand_count" },
                    { "kind": "block", "type": "hand_gesture_is_hand_present" }
                ]
            },
            'image_classification': { 
                "kind": "category", "name": "Image Classification", "categorystyle": "image_classification_category", 
                "contents": [
                    { "kind": "block", "type": "image_classification_enable" },
                    { "kind": "block", "type": "image_classification_on_class" }, 
                    { "kind": "block", "type": "image_classification_is_class" },
                    { "kind": "block", "type": "image_classification_get_class" }
                ]
            },
            'object_detection': { 
                "kind": "category", "name": "Object Detection", "categorystyle": "object_detection_category", 
                "contents": [
                    { "kind": "block", "type": "object_detection_enable" },
                    { "kind": "block", "type": "object_detection_on_object" }, 
                    { "kind": "block", "type": "object_detection_is_object_detected" },
                    { "kind": "block", "type": "object_detection_for_each" },
                    { "kind": "block", "type": "object_detection_get_property" }
                ]
            },
            'custom_model': {
                "kind": "category",
                "name": "Custom Model",
                "categorystyle": "image_classification_category", 
                "contents": [
                    { "kind": "block", "type": "custom_model_setup",
                      "inputs": { "URL": { "shadow": { "type": "text", "fields": { "TEXT": "Paste Teachable Machine URL..." } } } }
                    },
                    { "kind": "block", "type": "custom_model_when_class" },
                    { "kind": "block", "type": "custom_model_is_class" }
                ]
            },
            'neopixel': { 
                "kind": "category", "name": "NeoPixel", "categorystyle": "actuators_category",
                "contents": [
                    { "kind": "label", "text": "Setup & Control"},
                    { "kind": "block", "type": "actuator_neopixel_setup", "inputs": { "NUM_PIXELS": { "shadow": { "type": "math_number", "fields": { "NUM": 8 } } } } },
                    { "kind": "block", "type": "actuator_neopixel_brightness" },
                    { "kind": "block", "type": "actuator_neopixel_show" },
                    { "kind": "block", "type": "actuator_neopixel_clear" },
                    { "kind": "sep", "gap": "24" },
                    { "kind": "label", "text": "Pixel Actions"},
                    { "kind": "block", "type": "actuator_neopixel_fill", "inputs": { "COLOR": { "shadow": { "type": "colour_picker", "fields": { "COLOUR": "#ff0000" } } } } },
                    { "kind": "block", "type": "actuator_neopixel_set", "inputs": { "PIXEL_NUM": { "shadow": { "type": "math_number", "fields": { "NUM": 0 } } }, "COLOR": { "shadow": { "type": "colour_picker", "fields": { "COLOUR": "#ff0000" } } } } },
                    { "kind": "block", "type": "actuator_neopixel_shift", "inputs": { "SHIFT": { "shadow": { "type": "math_number", "fields": { "NUM": 1 } } } } },
                    { "kind": "block", "type": "actuator_neopixel_rainbow" },
                    { "kind": "sep", "gap": "24" },
                    { "kind": "label", "text": "Colour Helpers"},
                    { "kind": "block", "type": "colour_picker" },
                    { "kind": "block", "type": "colour_rgb", "inputs": { "RED": { "shadow": { "type": "math_number", "fields": { "NUM": 255 }}}, "GREEN": { "shadow": { "type": "math_number", "fields": { "NUM": 0 }}}, "BLUE": { "shadow": { "type": "math_number", "fields": { "NUM": 0 }}}}},
                    { "kind": "block", "type": "colour_hsv_sliders_picker" },
                    { "kind": "block", "type": "colour_random" },
                ]
            },
            'display': {
                "kind": "category", "name": "Display", "categorystyle": "display_category",
                "contents": [
                    { "kind": "block", "type": "display_oled_setup" },
                    { "kind": "sep", "gap": "16" },
                    { "kind": "label", "text": "Drawing Actions"},
                    { "kind": "block", "type": "display_oled_text", "inputs": { "TEXT": { "shadow": { "type": "text", "fields": { "TEXT": "Hello" }}}, "X": { "shadow": { "type": "math_number", "fields": { "NUM": 0 }}}, "Y": { "shadow": { "type": "math_number", "fields": { "NUM": 0 }}}} },
                    { "kind": "block", "type": "display_oled_pixel", "inputs": { "X": { "shadow": { "type": "math_number", "fields": { "NUM": 10 }}}, "Y": { "shadow": { "type": "math_number", "fields": { "NUM": 10 }}}} },
                    { "kind": "block", "type": "display_oled_line", "inputs": { "X1": { "shadow": { "type": "math_number", "fields": { "NUM": 0 }}}, "Y1": { "shadow": { "type": "math_number", "fields": { "NUM": 0 }}}, "X2": { "shadow": { "type": "math_number", "fields": { "NUM": 127 }}}, "Y2": { "shadow": { "type": "math_number", "fields": { "NUM": 63 }}}} },
                    { "kind": "block", "type": "display_oled_rect", "inputs": { "X": { "shadow": { "type": "math_number", "fields": { "NUM": 10 }}}, "Y": { "shadow": { "type": "math_number", "fields": { "NUM": 10 }}}, "WIDTH": { "shadow": { "type": "math_number", "fields": { "NUM": 20 }}}, "HEIGHT": { "shadow": { "type": "math_number", "fields": { "NUM": 15 }}}} },
                    { "kind": "block", "type": "display_create_bitmap" },
                    { "kind": "block", "type": "display_oled_draw_image", "inputs": { "X": { "shadow": { "type": "math_number", "fields": { "NUM": 0 }}}, "Y": { "shadow": { "type": "math_number", "fields": { "NUM": 0 }}}} },
                    { "kind": "sep", "gap": "16" },
                    { "kind": "label", "text": "Display Control"},
                    { "kind": "block", "type": "display_oled_show" },
                    { "kind": "block", "type": "display_oled_clear" },
                    { "kind": "block", "type": "display_oled_power" },
                    { "kind": "block", "type": "display_oled_contrast", "inputs": { "CONTRAST": { "shadow": { "type": "math_number", "fields": { "NUM": 255 } } } } },
                    { "kind": "block", "type": "display_oled_invert" },
                    { "kind": "sep", "gap": "16" },
                    { "kind": "block", "type": "display_oled_animate_fireworks", "inputs": { "DURATION": { "shadow": { "type": "math_number", "fields": { "NUM": 5 } } } } },
                ]
            },
            'wifi': {
                "kind": "category", "name": "Wi-Fi", "categorystyle": "networking_category",
                "contents": [
                    { "kind": "block", "type": "wifi_connect", "inputs": { "SSID": { "shadow": { "type": "text", "fields": { "TEXT": "my_ssid" } } }, "PASSWORD": { "shadow": { "type": "text", "fields": { "TEXT": "password" } } } } },
                    { "kind": "block", "type": "wifi_is_connected" },
                    { "kind": "block", "type": "wifi_get_ip" },
                    { "kind": "block", "type": "http_get_json", "inputs": { "URL": { "shadow": { "type": "text", "fields": { "TEXT": "https://api.example.com/data" } } } } },
                    { "kind": "block", "type": "json_get_key", "inputs": { "KEY": { "shadow": { "type": "text", "fields": { "TEXT": "key_name" } } } } },
                    { "kind": "block", "type": "http_post_json", "inputs": { "URL": { "shadow": { "type": "text", "fields": { "TEXT": "https://maker.ifttt.com/..." } } } } },
                    { "kind": "block", "type": "wifi_start_web_server" },
                    { "kind": "block", "type": "wifi_on_web_request" },
                    { "kind": "block", "type": "wifi_get_web_request_path" },
                    { "kind": "block", "type": "wifi_send_web_response", "inputs": { "HTML": { "shadow": { "type": "text", "fields": { "TEXT": "<h1>Hello</h1>" } } } } },
                ]
            },
            'bluetooth': {
                "kind": "category", "name": "Bluetooth", "categorystyle": "bluetooth_category",
                "contents": [
                    { "kind": "block", "type": "ble_setup", "inputs": { "NAME": { "shadow": { "type": "text", "fields": { "TEXT": "MyDevice-BLE" } } } } },
                    { "kind": "block", "type": "ble_advertise_data", "inputs": { "DATA": { "shadow": { "type": "text", "fields": { "TEXT": "Hello" } } } } },
                ]
            }
        };

        const categoriesToAdd = [];

        loadedExtensionsSet.forEach(extensionId => {
            if (extensionCategories[extensionId]) {
                categoriesToAdd.push(extensionCategories[extensionId]);
            }
            
            if (extensionId === 'iot_dashboard' && dynamicDashboardBlocks.length > 0) {
                const dashboardCategory = {
                    "kind": "category",
                    "name": "Dashboard",
                    "categorystyle": "networking_category",
                    "contents": dynamicDashboardBlocks.map(blockDef => ({ "kind": "block", "type": blockDef.type }))
                };
                categoriesToAdd.push(dashboardCategory);
            }
        });

        const addExtensionIndex = finalToolbox.contents.findIndex(
            cat => cat.callbackKey === 'SHOW_EXTENSION_MODAL' || cat.custom === 'ADD_EXTENSION'
        );

        const insertIndex = (addExtensionIndex !== -1) ? addExtensionIndex : finalToolbox.contents.length;

        if (categoriesToAdd.length > 0) {
            finalToolbox.contents.splice(insertIndex, 0, ...categoriesToAdd);
        }

        this.toolbox = finalToolbox;
        if (this.workspace) {
            this.workspace.updateToolbox(this.toolbox);
        }
    }

async initialize() {
        this.workspace = Blockly.inject('blocklyArea', {
            theme: Esp32IdeTheme,
            toolbox: this.toolbox, 
            renderer: 'zelos',
            media: 'https://unpkg.com/blockly/media/',
            sounds: false,
            grid: { spacing: 20, length: 1, colour: 'var(--border-color)', snap: true },
            zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
            trashcan: true,
            move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true },
            plugins: {
                blockDragger: ScrollBlockDragger,
                metricsManager: ScrollMetricsManager,
            },
        });


        // 1. Backpack
        const backpack = new Backpack(this.workspace);
        backpack.init();

        // 2. Minimap
        //const minimap = new PositionedMinimap(this.workspace);
       // minimap.init();

        // 3. Scroll Options
        const scrollOptions = new ScrollOptions(this.workspace);
        scrollOptions.init();

        // 4. Cross-Tab Copy/Paste (with recommended option to remove default duplicate)
        const crossTabCopyPaste = new CrossTabCopyPaste();
        crossTabCopyPaste.init({ contextMenu: true, shortcut: true });
        Blockly.ContextMenuRegistry.registry.unregister('blockDuplicate');

        // 5. Zoom-to-Fit
        const zoomToFit = new ZoomToFitControl(this.workspace);
        zoomToFit.init();

        this.registerCallbacks();
        this.generator.init(this.workspace);
        this.generateCode();
    }
    
        registerCallbacks() {
            this.workspace.registerButtonCallback('CREATE_VARIABLE', (button) => { 
                Blockly.Variables.createVariableButtonHandler(button.getTargetWorkspace()); 
            });

            this.workspace.registerToolboxCategoryCallback('ADD_EXTENSION', () => {
                if (window.ide) {
                    window.ide.showExtensionModal();
                }
                return null; 
            });
        }

        generateCode() {
            if (!this.workspace) return;
            const code = this.generator.workspaceToCode(this.workspace);
            window.dispatchEvent(new CustomEvent('codeUpdated', { detail: code }));
        }
    }

    // ===== 4. SETUP AND EXPOSE THE MANAGER (Unchanged) =====
    function setupBlocklyForBoard(boardId, generator) {
        if (window.blockyManagerInstance) {
            console.warn("Blockly manager instance already exists. Skipping re-initialization.");
            return;
        }
        const blocklyManager = new BlocklyWorkspaceManager(boardId, generator);
        blocklyManager.initialize(); 
        window.blockyManagerInstance = blocklyManager;
    }

    // Call the main setup function with the provided arguments.
    setupBlocklyForBoard(boardId, generator);
}