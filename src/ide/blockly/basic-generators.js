// src/ide/blockly/basic-generators.js 

export function registerBasicGenerators(generator) {

    generator.ensureAiDataProcessor = function() {
        const functionName = 'process_ai_data';
        if (this.functionNames_[functionName]) {
            return;
        }
        this.definitions_['ai_event_handlers_list'] = 'ai_event_handlers = []';
        this.definitions_['import_sys'] = 'import sys';
        this.definitions_['import_ujson'] = 'import ujson as json';
        this.definitions_['import_uselect'] = 'import uselect';
        this.definitions_['ai_data_poller'] = 'poller = uselect.poll()\npoller.register(sys.stdin, uselect.POLLIN)';
        if (!this.definitions_['ai_data_dict']) {
            this.definitions_['ai_data_dict'] = 'ai_data = {}';
        }
        const func = `def ${functionName}():
    global ai_data
    if poller.poll(0):
        line = sys.stdin.readline()
        if line:
            line = line.strip()
            try:
                data = json.loads(line)
                if isinstance(data, dict):
                    ai_data = data
                    for handler in ai_event_handlers:
                        handler()
            except (ValueError, KeyError):
                pass`;
        this.functionNames_[functionName] = func;
    }

    generator.init = function(workspace) {
        // This function is correct from our previous fixes.
        Object.getPrototypeOf(this).init.call(this, workspace);
        this.connectionType = null;
        this.definitions_ = Object.create(null);
        this.functionNames_ = Object.create(null);
        this.aiEventHandlers = new Set();
        this.dashboardEventHandlers = {};
        this.definitions_['import_time'] = 'import time';
        this.isLiveMode = false;
    };

    generator.finish = function(code) {
        return code;
    };

    generator.workspaceToCode = function(workspace) {
        this.init(workspace);

        const allBlocks = workspace.getAllBlocks(false);
        for (const block of allBlocks) { delete block.generatedFuncName; }
        for (const block of allBlocks) { if (block.isEnabled()) { this.blockToCode(block); } }

        const topBlocks = workspace.getTopBlocks(true);
        const onStartBlock = topBlocks.find(b => b.type === 'on_start');
        const foreverBlock = topBlocks.find(b => b.type === 'forever');
        const everyXmsBlock = topBlocks.find(b => b.type === 'every_x_ms');

        let setupCode = '';
        if (onStartBlock) {
            setupCode = this.statementToCode(onStartBlock, 'DO') || 'pass';
        }
        
        let loopCode = '';
        if (foreverBlock) {
            loopCode = this.statementToCode(foreverBlock, 'DO') || this.INDENT + 'pass\n';
        } else if (everyXmsBlock) {
            loopCode = this.statementToCode(everyXmsBlock, 'DO') || this.INDENT + 'pass\n';
        }
        const everyXmsDelay = everyXmsBlock ? everyXmsBlock.getFieldValue('TIME') || '500' : '20';
        
        // 1. Remove the old, problematic line that was here:
        let definitions = Object.values(this.definitions_);
        definitions = definitions.filter((def, i) => definitions.indexOf(def) === i);
        const functions = Object.values(this.functionNames_);
        
        // 2. Build the handler list *after* the functions have been collected.
        let eventHandlerListCode = '';
        if (this.aiEventHandlers.size > 0) {
            eventHandlerListCode = `ai_event_handlers = [${Array.from(this.aiEventHandlers).join(', ')}]\n\n`;
        }
        
        // 3. Assemble the code in the CORRECT order.
        const preamble = definitions.join('\n') + '\n\n' + functions.join('\n\n');
        const startupMessage = "print('--- Starting Program ---')\ntime.sleep(1)\n";
        const aiProcessorCode = this.functionNames_['process_ai_data'] ? this.INDENT + 'process_ai_data()\n' : '';
        const hasUserLoopCode = loopCode.trim() && loopCode.trim() !== 'pass';
        const hasPollingCode = !!aiProcessorCode;

        let mainLoopCode = '';
        if (hasUserLoopCode || hasPollingCode) {
            mainLoopCode = `while True:\n${aiProcessorCode}${loopCode}${this.INDENT}time.sleep_ms(${everyXmsDelay})\n`;
        }

        // 4. Combine everything in the correct final order:
        let finalCode = preamble + '\n\n' + eventHandlerListCode + startupMessage + '# Code that runs once at the start\n' + setupCode + '\n\n' + mainLoopCode;

        return finalCode.trim();
    };


generator.forBlock['on_start'] = (b) => '';
generator.forBlock['forever'] = (b) => ''; 
generator.forBlock['every_x_ms'] = (b) => ''; 

generator.forBlock['control_delay_seconds'] = (b) => `time.sleep(float(${generator.valueToCode(b, 'DELAY_SEC', 0) || '1'}))\n`;
generator.forBlock['math_map'] = (b) => { const v=generator.valueToCode; const fN='math_map_func'; if(!generator.functionNames_[fN]){generator.functionNames_[fN]=`def ${fN}(x,i,a,o,u):\n    return (x-i)*(u-o)//(a-i)+o`} return[`${fN}(${v(b,'VALUE',0)},${v(b,'FROM_LOW',0)},${v(b,'FROM_HIGH',0)},${v(b,'TO_LOW',0)},${v(b,'TO_HIGH',0)})`,1];};
generator.forBlock['text_parse_to_number'] = (b) => [`int(${generator.valueToCode(b, 'TEXT', 0) || '0'})`, 1];
generator.forBlock['text_convert_to_text'] = (b) => [`str(${generator.valueToCode(b, 'VALUE', 0) || '""'})`, 1];
generator.forBlock['text_from_char_code'] = (b) => [`chr(int(${generator.valueToCode(b, 'CODE', 0) || '0'}))`, 1];
generator.forBlock['text_char_code_at'] = (b) => [`ord(${generator.valueToCode(b, 'TEXT', 4) || "''"}[int(${generator.valueToCode(b, 'AT', 0) || '0'})])`, 1];
generator.forBlock['lists_get_random_item'] = (b) => { generator.definitions_['import_random']='import random'; return[`random.choice(${generator.valueToCode(b, 'LIST', 0) || '[]'})`, 1];};

generator.forBlock['colour_from_hex'] = function(block) {
    const hex = generator.valueToCode(block, 'HEX', generator.ORDER_ATOMIC) || "'#000000'";
    const functionName = 'hex_to_rgb';
    if (!generator.functionNames_[functionName]) {
        const func = `
def ${functionName}(hex_color):
    hex_color = hex_color.lstrip('#')
    try: return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    except (ValueError, IndexError): return (0, 0, 0)`;
        generator.functionNames_[functionName] = func;
    }
    return [`${functionName}(${hex})`, generator.ORDER_FUNCTION_CALL];
};

generator.forBlock['colour_get_component'] = function(block) {
    const component = block.getFieldValue('COMPONENT');
    const colour = generator.valueToCode(block, 'COLOUR', generator.ORDER_ATOMIC) || '(0,0,0)';
    return [`${colour}[${component}]`, generator.ORDER_MEMBER];
};

generator.forBlock['colour_rgb_value'] = function(block) {
        const red = generator.valueToCode(block, 'RED', generator.ORDER_ATOMIC) || '0';
        const green = generator.valueToCode(block, 'GREEN', generator.ORDER_ATOMIC) || '0';
        const blue = generator.valueToCode(block, 'BLUE', generator.ORDER_ATOMIC) || '0';
        const code = `(max(0, min(255, int(${red}))), max(0, min(255, int(${green}))), max(0, min(255, int(${blue}))))`;
        return [code, generator.ORDER_ATOMIC];
    };

generator.forBlock['colour_hsv_sliders_picker'] = function(block) {
        const code = generator.quote_(block.getFieldValue('COLOUR'));
        return [code, generator.ORDER_ATOMIC];
    };


const originalBlockToCode = generator.blockToCode;
    generator.blockToCode = function(block) {
        if (!block) return '';
        const code = originalBlockToCode.call(this, block);
        if (block.id && Array.isArray(code) === false && typeof code === 'string' && code.includes('\n')) {
            return `# block_id=${block.id}\n${code}`;
        }
        return code;
    };

    generator.forBlock['comm_send_ai_command'] = function(block) {
        const command = block.getFieldValue('COMMAND');
        const param = generator.valueToCode(block, 'PARAM', generator.ORDER_ATOMIC) || '""';
        return `print(f"AI_CMD:{'${command}'}:{str(${param})}")\n`;
    };
}