// src/ide/blockly/custom-model-generators.js - REVIEW

export function registerCustomModelGenerators(generator) {
'use strict';

// This block correctly enables the AI data stream by calling ensureAiDataProcessor.
// It generates no Python code itself, which is correct.
generator.forBlock['custom_model_setup'] = function(block) {
    generator.ensureAiDataProcessor();
    return '# UI: Custom model configured in browser.\\n';
};

// This correctly creates a Python function that will be called on every new data packet.
// The function checks if the 'category' in the ai_data dictionary matches the selected class.
generator.forBlock['custom_model_when_class'] = function(block) {
    generator.ensureAiDataProcessor();
    const className = block.getFieldValue('CLASS_NAME');
    if (className === 'NONE') return '';

    const statements_do = generator.statementToCode(block, 'DO') || generator.INDENT + 'pass\\n';
    const functionName = generator.nameDB_.getDistinctName(`on_custom_class_${className}`, 'PROCEDURE');

    const func = `def ${functionName}():
${generator.INDENT}if ai_data.get('classification', {}).get('category', '') == '${className}':
${generator.prefixLines(statements_do, generator.INDENT)}`;

    generator.functionNames_[functionName] = func;
    if (!generator.aiEventHandlers) generator.aiEventHandlers = new Set();
    generator.aiEventHandlers.add(functionName);
    
    return ''; // Correct for a hat block.
};

// This correctly generates a boolean expression to check the current classification.
generator.forBlock['custom_model_is_class'] = function(block) {
    generator.ensureAiDataProcessor();
    const className = block.getFieldValue('CLASS_NAME');
    if (className === 'NONE') return ['False', generator.ORDER_ATOMIC];

    const code = `ai_data.get('classification', {}).get('category', '') == '${className}'`;
    return [code, generator.ORDER_EQUALITY];
};

}