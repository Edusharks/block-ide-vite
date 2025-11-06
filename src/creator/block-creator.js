document.addEventListener('DOMContentLoaded', () => {

    // --- STATE ---
    let blockDefinition = {
        name: 'my block %1',
        type: 'custom_my_block',
        tooltip: '',
        color: '#5b67e8',
        style: 'logic_blocks',
        connections: {
            output: false,
            outputType: '',
            previous: true,
            next: true,
        },
        inputsInline: true,
        inputs: [],
        pythonTemplate: ''
    };
    let nextInputId = 0;

    // --- UI ELEMENTS ---
    const ui = {
        name: document.getElementById('block-name'),
        tooltip: document.getElementById('block-tooltip'),
        color: document.getElementById('block-color'),
        style: document.getElementById('block-style'),
        connPrev: document.getElementById('conn-prev'),
        connNext: document.getElementById('conn-next'),
        connOutput: document.getElementById('conn-output'),
        outputTypeWrapper: document.getElementById('output-type-wrapper'),
        outputType: document.getElementById('output-type'),
        inputsInline: document.getElementById('inputs-inline'),
        inputsList: document.getElementById('inputs-list'),
        newInputType: document.getElementById('new-input-type'),
        addInputBtn: document.getElementById('add-input-btn'),
        previewSvg: document.getElementById('preview-svg'),
        previewPath: document.getElementById('preview-path'),
        previewContent: document.getElementById('preview-content'),
        pythonTemplate: document.getElementById('python-template'),
        jsonOutput: document.getElementById('generated-json-output'),
        saveBtn: document.getElementById('save-block-btn'),
    };

    // --- CONSTANTS ---
    const BLOCK_DEFAULTS = {
        height: 48,
        paddingX: 8,
        paddingY: 8,
        notchWidth: 15,
        notchHeight: 4,
        cornerRadius: 4,
        outputTabWidth: 20,
    };
    const FIELD_DEFAULTS = {
        height: 28,
        paddingX: 4,
        paddingY: 4,
        text: { width: 80 },
        number: { width: 40 },
        angle: { width: 28 },
        checkbox: { width: 28 },
        colour: { width: 28 },
        dropdown: { width: 80 },
    };

    // --- RENDER FUNCTIONS ---

    function renderAll() {
        renderInputsList();
        renderPreview();
        renderGeneratedOutput();
    }

    function renderInputsList() {
        ui.inputsList.innerHTML = '';
        blockDefinition.inputs.forEach(input => {
            const item = document.createElement('div');
            item.className = 'input-config-item';
            const namePlaceholder = input.type.startsWith('field_') ? 'e.g., FIELD_NAME' : 'e.g., INPUT_NAME';

            item.innerHTML = `
                <div class="input-config-header">
                    <span>Input #${input.id + 1} (${input.type.replace('_',' ')})</span>
                    <button class="delete-input-btn" data-id="${input.id}">&times;</button>
                </div>
                <div class="dual-grid">
                    <div>
                        <label>Input Name (for code)</label>
                        <input type="text" class="input-prop" data-id="${input.id}" data-prop="name" value="${input.name}" placeholder="${namePlaceholder}">
                    </div>
                    ${input.type.startsWith('field_') ? `
                    <div>
                        <label>Default Value</label>
                        <input type="text" class="input-prop" data-id="${input.id}" data-prop="default" value="${input.default || ''}">
                    </div>
                    ` : ''}
                </div>
                ${input.type === 'field_dropdown' ? `
                    <div style="margin-top: 0.5rem">
                        <label>Options (displayName,VALUE)</label>
                        <textarea class="input-prop" data-id="${input.id}" data-prop="options" rows="3">${input.options.map(o => o.join(',')).join('\n')}</textarea>
                    </div>
                ` : ''}
            `;
            ui.inputsList.appendChild(item);
        });
    }

    function renderPreview() {
        ui.previewPath.style.fill = blockDefinition.color;
        const nameParts = blockDefinition.name.split(/%(\d+)/);
        let currentX = BLOCK_DEFAULTS.paddingX;
        let totalWidth = 0;
        let maxHeight = 0;

        // --- 1. Calculate size and create content elements ---
        ui.previewContent.innerHTML = '';
        const contentElements = [];

        nameParts.forEach((part, index) => {
            if (index % 2 === 0) { // Text part
                if (part) {
                    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    text.textContent = part.trim();
                    text.setAttribute('x', currentX);
                    text.setAttribute('y', BLOCK_DEFAULTS.height / 2);
                    text.setAttribute('dy', '0.35em');
                    ui.previewContent.appendChild(text);
                    const textWidth = text.getBBox().width;
                    currentX += textWidth + FIELD_DEFAULTS.paddingX;
                    totalWidth += textWidth + FIELD_DEFAULTS.paddingX;
                }
            } else { // Input part
                const inputIndex = parseInt(part, 10) - 1;
                const inputDef = blockDefinition.inputs[inputIndex];
                if (inputDef) {
                    const fieldWidth = FIELD_DEFAULTS[inputDef.type.replace('field_', '').replace('input_','')]?.width || 80;
                    const fieldHeight = FIELD_DEFAULTS.height;

                    if (inputDef.type.startsWith('input_')) {
                        const puzzlePath = `M ${currentX},${(BLOCK_DEFAULTS.height-fieldHeight)/2} h -4 c -5,0 -5,12 0,12 h 4 v ${fieldHeight-12} h -4 c -5,0 -5,12 0,12 h 4`;
                        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
                        p.setAttribute('d', puzzlePath);
                        p.setAttribute('fill', blockDefinition.color);
                        p.setAttribute('stroke', 'rgba(0,0,0,0.2)');
                        ui.previewContent.appendChild(p);
                    }
                    
                    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    rect.setAttribute('x', currentX);
                    rect.setAttribute('y', (BLOCK_DEFAULTS.height - fieldHeight) / 2);
                    rect.setAttribute('width', fieldWidth);
                    rect.setAttribute('height', fieldHeight);
                    rect.setAttribute('class', 'preview-field-rect');
                    ui.previewContent.appendChild(rect);
                    
                    currentX += fieldWidth + FIELD_DEFAULTS.paddingX;
                    totalWidth += fieldWidth + FIELD_DEFAULTS.paddingX;
                }
            }
        });
        totalWidth += BLOCK_DEFAULTS.paddingX;
        if(blockDefinition.connections.output) totalWidth += BLOCK_DEFAULTS.outputTabWidth / 2;

        // --- 2. Generate SVG Path ---
        let path = '';
        const w = Math.max(100, totalWidth);
        const h = BLOCK_DEFAULTS.height;
        const cr = BLOCK_DEFAULTS.cornerRadius;
        const nw = BLOCK_DEFAULTS.notchWidth;
        const nh = BLOCK_DEFAULTS.notchHeight;
        const ot = BLOCK_DEFAULTS.outputTabWidth;

        if (blockDefinition.connections.output) {
            path += `M ${ot},0 H ${w-cr} a ${cr},${cr} 0 0 1 ${cr},${cr} V ${h-cr} a ${cr},${cr} 0 0 1 -${cr},${cr} H ${ot}`;
            path += ` c -5,0 -5,20 0,20 H 0 V ${ot} c 5,0 5,-20 0,-20 Z`;
        } else {
            path += `M 0,${cr} a ${cr},${cr} 0 0 1 ${cr},-${cr}`;
            if (blockDefinition.connections.previous) {
                path += ` h ${cr*2} v -${nh/2} c 0,-${nh} ${nw},-${nh} ${nw},0 v ${nh/2}`;
            }
            path += ` H ${w-cr} a ${cr},${cr} 0 0 1 ${cr},${cr} V ${h-cr} a ${cr},${cr} 0 0 1 -${cr},${cr}`;
            if (blockDefinition.connections.next) {
                 path += ` H ${cr*2 + nw} v ${nh/2} c 0,${nh} -${nw},${nh} -${nw},0 v -${nh/2}`;
            }
            path += ` H ${cr} a ${cr},${cr} 0 0 1 -${cr},-${cr} Z`;
        }
        
        ui.previewPath.setAttribute('d', path);
        ui.previewSvg.setAttribute('width', w);
        ui.previewSvg.setAttribute('height', h);
        if(blockDefinition.connections.output) {
            ui.previewContent.setAttribute('transform', `translate(${ot}, 0)`);
        } else {
             ui.previewContent.setAttribute('transform', 'translate(0, 0)');
        }
    }

    function renderGeneratedOutput() {
        blockDefinition.type = `custom_${blockDefinition.name.split(' ')[0].trim().toLowerCase().replace(/[^a-z0-9_]/g, '')}`;

        let message = blockDefinition.name;
        let args = [];
        
        blockDefinition.inputs.forEach((input, i) => {
            const argDef = { type: input.type, name: input.name.toUpperCase() };
            if(input.default) argDef.default = isNaN(input.default) ? input.default : Number(input.default);
            if(input.options) argDef.options = input.options;
            
            // For value inputs, add check
            if (input.type === 'input_value') {
                argDef.check = "Any"; // Basic default
            }

            args.push(argDef);
        });

        const finalJson = {
            blocklyJson: {
                type: blockDefinition.type,
                message0: message.trim(),
                args0: args,
                previousStatement: blockDefinition.connections.previous ? null : undefined,
                nextStatement: blockDefinition.connections.next ? null : undefined,
                output: blockDefinition.connections.output ? (blockDefinition.connections.outputType || null) : undefined,
                inputsInline: blockDefinition.inputsInline,
                colour: blockDefinition.color,
                tooltip: blockDefinition.tooltip,
            },
            pythonGenerator: {
                template: blockDefinition.pythonTemplate,
                output: blockDefinition.connections.output,
            }
        };

        ui.jsonOutput.value = JSON.stringify(finalJson, null, 2);
    }

    // --- EVENT HANDLERS ---
    function handleMainConfigChange() {
        blockDefinition.name = ui.name.value;
        blockDefinition.tooltip = ui.tooltip.value;
        blockDefinition.color = ui.color.value;
        blockDefinition.style = ui.style.value;
        blockDefinition.pythonTemplate = ui.pythonTemplate.value;
        blockDefinition.connections.previous = ui.connPrev.checked;
        blockDefinition.connections.next = ui.connNext.checked;
        blockDefinition.connections.output = ui.connOutput.checked;
        blockDefinition.connections.outputType = ui.outputType.value;
        blockDefinition.inputsInline = ui.inputsInline.checked;

        // Logic for connections
        if (blockDefinition.connections.output) {
            ui.connPrev.checked = false; ui.connNext.checked = false;
            blockDefinition.connections.previous = false; blockDefinition.connections.next = false;
        }
        ui.connPrev.disabled = blockDefinition.connections.output;
        ui.connNext.disabled = blockDefinition.connections.output;
        ui.outputTypeWrapper.classList.toggle('hidden', !blockDefinition.connections.output);

        renderAll();
    }

    function handleAddInput() {
        const type = ui.newInputType.value;
        const newId = nextInputId++;
        const newInput = {
            id: newId,
            type: type,
            name: `${type.split('_').pop()}${newId+1}`.toUpperCase(),
        };
        if (type === 'field_dropdown') {
            newInput.options = [['option 1', 'VALUE_1'], ['option 2', 'VALUE_2']];
        }
        if (type.startsWith('field_')) {
            newInput.default = '';
        }

        blockDefinition.inputs.push(newInput);
        
        // Update name to include new placeholder if not already there
        if(!blockDefinition.name.includes(`%${blockDefinition.inputs.length}`)) {
            blockDefinition.name += ` %${blockDefinition.inputs.length}`;
            ui.name.value = blockDefinition.name;
        }
        
        renderAll();
    }

    function handleInputsListEvent(e) {
        const target = e.target;
        const id = parseInt(target.dataset.id);
        const input = blockDefinition.inputs.find(i => i.id === id);

        if (target.classList.contains('delete-input-btn')) {
            blockDefinition.inputs = blockDefinition.inputs.filter(input => input.id !== id);
        }
        else if (target.classList.contains('input-prop')) {
            const prop = target.dataset.prop;
            if (input) {
                if (prop === 'options') {
                    input[prop] = target.value.split('\n').map(line => {
                        const parts = line.split(',');
                        return [parts[0].trim(), (parts[1] || parts[0]).trim()];
                    });
                } else {
                    input[prop] = target.value;
                }
            }
        }
        renderAll();
    }

    function handleSave() {
        renderGeneratedOutput(); // Ensure output is up to date
        const content = ui.jsonOutput.value;
        const type = JSON.parse(content).blocklyJson.type || 'custom_block';
        const blob = new Blob([content], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${type}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }
    

    // --- INITIALIZATION ---
    [ui.name, ui.tooltip, ui.color, ui.style, ui.pythonTemplate, ui.outputType].forEach(el => 
        el.addEventListener('input', handleMainConfigChange)
    );
    [ui.connPrev, ui.connNext, ui.connOutput, ui.inputsInline].forEach(el =>
        el.addEventListener('change', handleMainConfigChange)
    );
    
    ui.addInputBtn.addEventListener('click', handleAddInput);
    ui.inputsList.addEventListener('input', handleInputsListEvent);
    ui.inputsList.addEventListener('click', handleInputsListEvent); // For delete button
    ui.saveBtn.addEventListener('click', handleSave);

    // Initial render on page load
    ui.name.value = blockDefinition.name;
    ui.connPrev.checked = blockDefinition.connections.previous;
    ui.connNext.checked = blockDefinition.connections.next;
    ui.inputsInline.checked = blockDefinition.inputsInline;
    renderAll();
});