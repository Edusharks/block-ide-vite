// src/renderer/blockly/pico-generators.js
export function registerPicoGenerators(generator) {
// Helper to ensure machine-specific imports are added only when needed
function ensureMachineImport() {
    generator.definitions_['import_machine'] = 'from machine import Pin, PWM, ADC, I2C, SoftI2C';
}

function getRgbHelper() {
    const functionName = 'hex_to_rgb';
    if (!generator.functionNames_[functionName]) {
        const func = `
def ${functionName}(hex_color):
    hex_color = hex_color.lstrip('#')
    try:
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    except (ValueError, IndexError):
        return (0, 0, 0)`;
        generator.functionNames_[functionName] = func;
    }
    return functionName;
}

function getBrightnessHelper() {
    const functionName = '_apply_brightness';
    if (!generator.functionNames_[functionName]) {
        const func = `
_neopixel_brightness = 1.0
def ${functionName}(color_tuple):
    global _neopixel_brightness
    r, g, b = color_tuple
    return (int(r * _neopixel_brightness), int(g * _neopixel_brightness), int(b * _neopixel_brightness))`;
        generator.functionNames_[functionName] = func;
    }
    return functionName;
}

function getResolveColorHelper() {
    const functionName = '_resolve_color';
    if (!generator.functionNames_[functionName]) {
        const rgbFunc = getRgbHelper();
        const func = `
def ${functionName}(c):
    if isinstance(c, str):
        return ${rgbFunc}(c)
    return c`;
        generator.functionNames_[functionName] = func;
    }
    return functionName;
}

// --- GPIO Block Generators ---
generator.forBlock['gpio_digital_read'] = function(block) {
    ensureMachineImport();
    const pin = block.getFieldValue('PIN');
    const pinVar = `pin_${pin}`;
    if (!generator.definitions_[pinVar]) {
        generator.definitions_[pinVar] = `${pinVar} = Pin(${pin}, Pin.IN, Pin.PULL_UP)`;
    }
    const code = `${pinVar}.value()`;
    return [code, generator.ORDER_FUNCTION_CALL];
};

generator.forBlock['gpio_digital_write'] = function(block) {
    ensureMachineImport();
    const pin = block.getFieldValue('PIN');
    const state = block.getFieldValue('STATE');
    const pinVar = `pin_${pin}`;
    if (!generator.definitions_[pinVar]) {
        generator.definitions_[pinVar] = `${pinVar} = Pin(${pin}, Pin.OUT)`;
    }
    return `${pinVar}.value(${state})\n`;
};

generator.forBlock['gpio_analog_read'] = function(block) {
    ensureMachineImport();
    const pin = block.getFieldValue('PIN');
    const adcVar = `adc_${pin}`;
    if (!generator.definitions_[adcVar]) {
        generator.definitions_[adcVar] = `${adcVar} = ADC(Pin(${pin}))`;
    }
    return [`${adcVar}.read_u16()`, generator.ORDER_FUNCTION_CALL];
};

generator.forBlock['gpio_pwm_write'] = function(block) {
    ensureMachineImport();
    const pin = block.getFieldValue('PIN');
    const value = generator.valueToCode(block, 'VALUE', generator.ORDER_ATOMIC) || '0';
    const pwmVar = `pwm_${pin}`;
    if (!generator.definitions_[pwmVar]) {
        generator.definitions_[pwmVar] = `${pwmVar} = PWM(Pin(${pin}))`;
        generator.definitions_[`${pwmVar}_freq`] = `${pwmVar}.freq(1000)`;
    }
    return `${pwmVar}.duty_u16(int(max(0, min(255, ${value})) * 65535 / 255))\n`;
};

// --- Sensor Generators ---
generator.forBlock['sensor_internal_temp'] = function(block) {
    ensureMachineImport();
    const unit = block.getFieldValue('UNIT');
    generator.definitions_['internal_temp_sensor'] = 'sensor_temp = ADC(4)';
    const formula = `27 - (sensor_temp.read_u16() * 3.3 / 65535 - 0.706) / 0.001721`;
    let code = `(${formula})`;
    if (unit === 'F') {
        code = `(${code} * 9/5 + 32)`;
    }
    return [code, generator.ORDER_FUNCTION_CALL];
};

generator.forBlock['sensor_dht_measure'] = function(block) {
    ensureMachineImport();
    const pin = block.getFieldValue('PIN');
    const dhtSensorVar = `dht_sensor_${pin}`;
    if (!generator.definitions_[dhtSensorVar]) {
        generator.definitions_['import_dht'] = 'import dht';
        generator.definitions_[dhtSensorVar] = `${dhtSensorVar} = dht.DHT11(Pin(${pin}))`;
    }
    return `try:\n${generator.INDENT}${dhtSensorVar}.measure()\nexcept OSError as e:\n${generator.INDENT}print("DHT read error:", e)\n`;
};

generator.forBlock['sensor_dht11'] = function(block) {
    ensureMachineImport();
    const pin = block.getFieldValue('PIN');
    const readingType = block.getFieldValue('READING');
    const dhtSensorVar = `dht_sensor_${pin}`;
    if (!generator.definitions_[dhtSensorVar]) {
        generator.definitions_['import_dht'] = 'import dht';
        generator.definitions_[dhtSensorVar] = `${dhtSensorVar} = dht.DHT11(Pin(${pin}))`;
    }
    return [`${dhtSensorVar}.${readingType}()`, generator.ORDER_FUNCTION_CALL];
};

generator.forBlock['sensor_analog_percent'] = function(block) {
    const code = generator.forBlock['gpio_analog_read'](block)[0];
    return [`round((${code} / 65535) * 100)`, generator.ORDER_FUNCTION_CALL];
};

generator.forBlock['sensor_ultrasonic_hcsr04'] = function(block) {
    ensureMachineImport();
    generator.definitions_['import_hcsr04'] = 'from hcsr04 import HCSR04';
    const trigPin = block.getFieldValue('TRIG_PIN');
    const echoPin = block.getFieldValue('ECHO_PIN');
    const unit = block.getFieldValue('UNIT');
    const sensorVar = `ultrasonic_${trigPin}_${echoPin}`;
    if (!generator.definitions_[sensorVar]) {
        generator.definitions_[sensorVar] = `${sensorVar} = HCSR04(trigger_pin=${trigPin}, echo_pin=${echoPin})`;
    }
    const code = `${sensorVar}.distance_${unit.toLowerCase()}()`;
    return [code, generator.ORDER_FUNCTION_CALL];
};

generator.forBlock['sensor_pir_motion'] = generator.forBlock['gpio_digital_read'];
generator.forBlock['sensor_limit_switch'] = function(block) {
    const code = generator.forBlock['gpio_digital_read'](block)[0];
    return [`not ${code}`, generator.ORDER_LOGICAL_NOT];
};

// --- Actuator Generators ---
generator.forBlock['actuator_onboard_led'] = function(block) {
    ensureMachineImport();
    const state = block.getFieldValue('STATE');
    generator.definitions_['onboard_led'] = `onboard_led = Pin("LED", Pin.OUT)`;
    return `onboard_led.value(${state})\n`;
};

generator.forBlock['actuator_led'] = generator.forBlock['gpio_digital_write'];

generator.forBlock['actuator_led_toggle'] = function(block) {
    ensureMachineImport();
    const pin = block.getFieldValue('PIN');
    const pinVar = `pin_${pin}`;
    if (!generator.definitions_[pinVar]) {
        generator.definitions_[pinVar] = `${pinVar} = Pin(${pin}, Pin.OUT)`;
    }
    return `${pinVar}.toggle()\n`;
};

generator.forBlock['actuator_buzzer_note'] = function(block) {
    ensureMachineImport();
    const pin = block.getFieldValue('PIN');
    const noteFreq = block.getFieldValue('NOTE');
    const duration = generator.valueToCode(block, 'DURATION', generator.ORDER_ATOMIC) || '100';
    const pwmVar = `buzzer_pwm_${pin}`;
    if (!generator.definitions_[pwmVar]) {
        generator.definitions_[pwmVar] = `${pwmVar} = PWM(Pin(${pin}))`;
    }
    return `${pwmVar}.freq(int(${noteFreq}))\n${pwmVar}.duty_u16(32768)\ntime.sleep_ms(int(${duration}))\n${pwmVar}.duty_u16(0)\n`;
};

generator.forBlock['actuator_servo_positional'] = function(block) {
    ensureMachineImport();
    const pin = block.getFieldValue('PIN');
    const angle = block.getFieldValue('ANGLE') || '90'; 
    const servoVar = `servo_${pin}`;
    const functionName = 'set_servo_angle';
    if (!generator.functionNames_[functionName]) {
        const func = `
def ${functionName}(pwm_obj, angle):
    duty = int(1638 + (max(0, min(180, angle)) / 180) * 6553)
    pwm_obj.duty_u16(duty)`;
        generator.functionNames_[functionName] = func;
    }
    if (!generator.definitions_[servoVar]) {
        generator.definitions_[servoVar] = `${servoVar} = PWM(Pin(${pin}), freq=50)`;
    }
    return `${functionName}(${servoVar}, int(${angle}))\n`;
};

generator.forBlock['actuator_servo_continuous'] = function(block) {
    const speed = block.getFieldValue('SPEED') || '0';
    // Map speed from -100..100 to angle 0..180
    const mapped_angle = `(max(-100, min(100, ${speed})) + 100) * 180 / 200`;
    // Create a temporary block-like object to pass to the positional servo generator
    const servoBlock = {
        getFieldValue: (name) => {
            if (name === 'PIN') return block.getFieldValue('PIN');
            if (name === 'ANGLE') return mapped_angle;
            return null;
        }
    };
    return generator.forBlock['actuator_servo_positional'](servoBlock);
};
// --- NeoPixel Generators ---
generator.forBlock['actuator_neopixel_setup'] = function(block) {
    ensureMachineImport();
    const pin = block.getFieldValue('PIN');
    const num_pixels = generator.valueToCode(block, 'NUM_PIXELS', generator.ORDER_ATOMIC) || '8';
    generator.definitions_['import_neopixel'] = 'import neopixel';
    generator.definitions_['neopixel_strip'] = `np = neopixel.NeoPixel(Pin(${pin}), int(${num_pixels}))`;
    generator.definitions_['rainbow_cycle_start'] = 'rainbow_cycle_start = 0';
    getBrightnessHelper(); 
    return '';
};

generator.forBlock['actuator_neopixel_brightness'] = function(block) {
    const brightness = generator.valueToCode(block, 'BRIGHTNESS', generator.ORDER_ATOMIC) || '50';
    getBrightnessHelper();
    return `_neopixel_brightness = (max(0, min(100, int(${brightness}))) / 100)\n`;
};

generator.forBlock['actuator_neopixel_fill'] = function(block) {
    const color = generator.valueToCode(block, 'COLOR', generator.ORDER_ATOMIC) || "'#ff0000'";
    const resolveColorFunc = getResolveColorHelper();
    const brightnessFunc = getBrightnessHelper();
    return `np.fill(${brightnessFunc}(${resolveColorFunc}(${color})))\nnp.write()\n`;
};

generator.forBlock['actuator_neopixel_set'] = function(block) {
    const pixel_num = generator.valueToCode(block, 'PIXEL_NUM', generator.ORDER_ATOMIC) || '0';
    const color = generator.valueToCode(block, 'COLOR', generator.ORDER_ATOMIC) || "'#ff0000'";
    const resolveColorFunc = getResolveColorHelper();
    const brightnessFunc = getBrightnessHelper();
    return `np[int(${pixel_num})] = ${brightnessFunc}(${resolveColorFunc}(${color}))\n`;
};

generator.forBlock['actuator_neopixel_shift'] = function(block) {
    const shift = generator.valueToCode(block, 'SHIFT', generator.ORDER_ATOMIC) || '1';
    const functionName = 'neopixel_shift';
    if (!generator.functionNames_[functionName]) {
        const func = `
def ${functionName}(strip, amount):
    num_pixels = len(strip)
    if num_pixels == 0 or amount == 0: return
    amount %= num_pixels
    if amount > 0:
        last_pixels = [strip[i] for i in range(num_pixels - amount, num_pixels)]
        for i in range(num_pixels - 1, amount - 1, -1): strip[i] = strip[i - amount]
        for i in range(amount): strip[i] = last_pixels[i]
    else:
        amount = -amount
        first_pixels = [strip[i] for i in range(amount)]
        for i in range(num_pixels - amount): strip[i] = strip[i + amount]
        for i in range(amount): strip[num_pixels - amount + i] = first_pixels[i]
`;
        generator.functionNames_[functionName] = func;
    }
    return `${functionName}(np, int(${shift}))\n`;
};

generator.forBlock['actuator_neopixel_rainbow'] = function(block) {
    const wheelFuncName = 'neopixel_wheel';
    const brightnessFunc = getBrightnessHelper();
    if (!generator.functionNames_[wheelFuncName]) {
        const func = `
def ${wheelFuncName}(pos):
    pos = 255 - pos
    if pos < 85: return (255 - pos * 3, 0, pos * 3)
    if pos < 170: pos -= 85; return (0, pos * 3, 255 - pos * 3)
    pos -= 170; return (pos * 3, 255 - pos * 3, 0)
`;
        generator.functionNames_[wheelFuncName] = func;
    }
    const rainbowFuncName = 'neopixel_rainbow_step';
    if (!generator.functionNames_[rainbowFuncName]) {
        const func = `
def ${rainbowFuncName}(strip):
    global rainbow_cycle_start
    num_pixels = len(strip)
    for i in range(num_pixels):
        pixel_index = (i * 256 // num_pixels) + rainbow_cycle_start
        strip[i] = ${brightnessFunc}(${wheelFuncName}(pixel_index & 255))
    strip.write()
    rainbow_cycle_start = (rainbow_cycle_start + 1) % 256
`;
        generator.functionNames_[rainbowFuncName] = func;
    }
    return `${rainbowFuncName}(np)\n`;
};

generator.forBlock['actuator_neopixel_show'] = () => 'np.write()\n';
generator.forBlock['actuator_neopixel_clear'] = () => `np.fill((0, 0, 0))\nnp.write()\n`;

// --- OLED Display Generators ---
generator.forBlock['display_oled_setup'] = function(block) {
    generator.definitions_['import_machine'] = 'from machine import Pin, PWM, ADC, I2C, SoftI2C';
    generator.definitions_['import_ssd1306'] = 'import ssd1306';
    const pins = block.getFieldValue('PINS');
    const sdaPin = pins;
    const sclPin = parseInt(pins) + 1;
    const setupCode = `
try:
    time.sleep(1)
    i2c = SoftI2C(sda=Pin(${sdaPin}), scl=Pin(${sclPin}))
    display = ssd1306.SSD1306_I2C(128, 64, i2c)
    display.fill(0)
    display.show()
    print("OLED display initialized.")
except Exception as e:
    print("Failed to initialize OLED display:", e)
    display = None
`;
    generator.definitions_['oled_setup'] = setupCode;
    return '';
};

generator.forBlock['display_oled_clear'] = () => 'if display: display.fill(0)\n';
generator.forBlock['display_oled_show'] = () => 'if display: display.show()\n';
generator.forBlock['display_oled_power'] = (b) => `if display: display.${b.getFieldValue('STATE')}()\n`;
generator.forBlock['display_oled_contrast'] = (b) => `if display: display.contrast(max(0, min(255, int(${generator.valueToCode(b, 'CONTRAST', 0) || '255'}))))\n`;
generator.forBlock['display_oled_invert'] = (b) => `if display: display.invert(${b.getFieldValue('INVERT')})\n`;
generator.forBlock['display_oled_text'] = (b) => `if display: display.text(str(${generator.valueToCode(b, 'TEXT', 0) || '""'}), int(${generator.valueToCode(b, 'X', 0) || '0'}), int(${generator.valueToCode(b, 'Y', 0) || '0'}))\n`;
generator.forBlock['display_oled_pixel'] = (b) => `if display: display.pixel(int(${generator.valueToCode(b, 'X', 0) || '0'}), int(${generator.valueToCode(b, 'Y', 0) || '0'}), ${b.getFieldValue('COLOR')})\n`;
generator.forBlock['display_oled_line'] = (b) => `if display: display.line(int(${generator.valueToCode(b, 'X1', 0) || '0'}), int(${generator.valueToCode(b, 'Y1', 0) || '0'}), int(${generator.valueToCode(b, 'X2', 0) || '0'}), int(${generator.valueToCode(b, 'Y2', 0) || '0'}), 1)\n`;
generator.forBlock['display_oled_rect'] = (b) => `if display: display.${b.getFieldValue('MODE')}(int(${generator.valueToCode(b, 'X', 0) || '0'}), int(${generator.valueToCode(b, 'Y', 0) || '0'}), int(${generator.valueToCode(b, 'WIDTH', 0) || '0'}), int(${generator.valueToCode(b, 'HEIGHT', 0) || '0'}), 1)\n`;

generator.forBlock['display_oled_animate_fireworks'] = function(block) {
    generator.definitions_['import_random_fw'] = 'import random';
    generator.definitions_['import_math_fw'] = 'import math';
    const duration = generator.valueToCode(block, 'DURATION', 0) || '5';
    const functionName = 'run_fireworks';
    if (!generator.functionNames_[functionName]) {
        generator.functionNames_[functionName] = `
class Particle:
    def __init__(self, x, y, vx, vy, gravity): self.x, self.y, self.vx, self.vy, self.gravity = x, y, vx, vy, gravity
    def update(self): self.x += self.vx; self.y += self.vy; self.vy += self.gravity
class Firework:
    def __init__(self, width, height): self.width, self.height, self.gravity = width, height, 0.08; self.reset()
    def reset(self): self.fuse = Particle(self.width//2, self.height-1, 0, -(2+random.random()*1), self.gravity/3); self.particles, self.exploded = [], False
    def update(self):
        if not self.exploded:
            self.fuse.update()
            if self.fuse.vy >= 0:
                self.exploded = True
                for _ in range(30 + random.randint(0, 30)):
                    angle, speed = random.random()*2*math.pi, random.random()*2
                    self.particles.append(Particle(self.fuse.x, self.fuse.y, math.cos(angle)*speed, math.sin(angle)*speed, self.gravity))
        else:
            for p in self.particles: p.update()
            self.particles = [p for p in self.particles if 0 <= p.x < self.width and 0 <= p.y < self.height]
            if not self.particles: self.reset()
    def draw(self, display):
        if not self.exploded: display.pixel(int(self.fuse.x), int(self.fuse.y), 1)
        else:
            for p in self.particles: display.pixel(int(p.x), int(p.y), 1)
def ${functionName}(disp, total_duration):
    if not disp: return
    fireworks = [Firework(disp.width, disp.height)]
    start_time = time.time()
    while time.time() - start_time < total_duration:
        disp.fill(0)
        if len(fireworks) < 3 and random.random() < 0.05: fireworks.append(Firework(disp.width, disp.height))
        for fw in fireworks: fw.update(); fw.draw(disp)
        disp.show(); time.sleep_ms(10)
`;
    }
    return `${functionName}(display, ${duration})\n`;
};

generator.forBlock['display_oled_create_image'] = function(block) {
    generator.definitions_['import_framebuf'] = 'import framebuf';
    const width = generator.valueToCode(block, 'WIDTH', 0) || '0';
    const height = generator.valueToCode(block, 'HEIGHT', 0) || '0';
    let data = generator.valueToCode(block, 'DATA', 0) || "''";
    data = `b${data}`;
    const code = `framebuf.FrameBuffer(bytearray(${data}), int(${width}), int(${height}), framebuf.MONO_HLSB)`;
    return [code, generator.ORDER_FUNCTION_CALL];
};

generator.forBlock['display_oled_draw_image'] = (b) => `if display and ${generator.valueToCode(b, 'IMAGE', 0) || 'None'}: display.blit(${generator.valueToCode(b, 'IMAGE', 0) || 'None'}, int(${generator.valueToCode(b, 'X', 0) || '0'}), int(${generator.valueToCode(b, 'Y', 0) || '0'}))\n`;

// --- Communication Generators ---
generator.forBlock['usb_serial_println'] = (b) => `print(str(${generator.valueToCode(b, 'DATA', 0) || '""'}))\n`;
generator.forBlock['usb_serial_print_value'] = (b) => `print(str(${generator.valueToCode(b, 'NAME', 0) || '""'}) + ' = ' + str(${generator.valueToCode(b, 'VALUE', 0) || '""'}))\n`;
generator.forBlock['usb_serial_read_line'] = () => ['input()', generator.ORDER_FUNCTION_CALL];
generator.forBlock['usb_serial_plot_value'] = function(block) {
    const value = generator.valueToCode(block, 'VALUE', generator.ORDER_ATOMIC) || '0';
    const name = generator.valueToCode(block, 'NAME', generator.ORDER_ATOMIC) || '"value"';
    const color = block.getFieldValue('COLOR');
    return `print("plot:" + str(${name}) + ":${color}:" + str(${value}))\n`;
};


// --- Wi-Fi Generators (REVISED AND CORRECTED) ---
generator.forBlock['wifi_connect'] = function(block) {
    const ssid = generator.valueToCode(block, 'SSID', 0) || '""';
    const password = generator.valueToCode(block, 'PASSWORD', 0) || '""';
    generator.definitions_['import_network'] = 'import network';
    generator.definitions_['import_time'] = 'import time';

    const funcName = 'connect_to_wifi';
    if (!generator.functionNames_[funcName]) {
        generator.definitions_['wlan_global'] = '_wlan = None';
        
        generator.functionNames_[funcName] = `
def ${funcName}(ssid, password):
    global _wlan
    if _wlan is None:
        _wlan = network.WLAN(network.STA_IF)
        _wlan.active(True)
    if _wlan.isconnected():
        return True
    print('Connecting to Wi-Fi...')
    _wlan.connect(ssid, password)
    for _ in range(15):
        if _wlan.isconnected():
            break
        print('.')
        time.sleep(1)
    if _wlan.isconnected():
        print('Connected! IP:', _wlan.ifconfig()[0])
        return True
    else:
        print('Connection failed.')
        return False
`;
    }
    return `${funcName}(${ssid}, ${password})\n`;
};

generator.forBlock['wifi_is_connected'] = function(block) {
    generator.definitions_['import_network'] = 'import network';
    return ['(_wlan.isconnected() if _wlan else False)', generator.ORDER_CONDITIONAL];
};

generator.forBlock['wifi_get_ip'] = function(block) {
    generator.definitions_['import_network'] = 'import network';
    return ["(_wlan.ifconfig()[0] if _wlan and _wlan.isconnected() else 'Not Connected')", generator.ORDER_CONDITIONAL];
};

generator.forBlock['http_get_json'] = function(block) { 
    generator.definitions_['import_urequests'] = 'import urequests';
    generator.definitions_['import_ujson'] = 'import ujson';
    return [`(ujson.loads(urequests.get(${generator.valueToCode(block,'URL',0)||"''"}).text) if _wlan and _wlan.isconnected() else {})`, generator.ORDER_FUNCTION_CALL];
};

generator.forBlock['json_get_key'] = function(block) {
    return [`${generator.valueToCode(block,'JSON',0)||"{}"}.get(${generator.valueToCode(block,'KEY',0)||"''"}, '')`, generator.ORDER_FUNCTION_CALL];
};

generator.forBlock['http_post_json'] = function(block) {
    generator.definitions_['import_urequests'] = 'import urequests';
    const url = generator.valueToCode(block, 'URL', 0) || '""';
    let data_dict = ['"value1": ' + (generator.valueToCode(block, 'VALUE1', 0) || 'None'), '"value2": ' + (generator.valueToCode(block, 'VALUE2', 0) || 'None'), '"value3": ' + (generator.valueToCode(block, 'VALUE3', 0) || 'None')];
    data_dict = data_dict.filter(item => !item.endsWith('None'));
    return `if _wlan and _wlan.isconnected():\n  try:\n    urequests.post(${url}, json={${data_dict.join(', ')}})\n  except Exception as e:\n    print("HTTP POST failed:", e)\n`;
};

// --- Web Server Generators (MULTI-THREADED VERSION) ---
generator.forBlock['wifi_start_web_server'] = function(block) {
    generator.definitions_['import_socket'] = 'import socket';
    generator.definitions_['import_thread'] = 'import _thread';
    generator.definitions_['import_ws_server'] = 'import websocket_server';
    generator.definitions_['import_ujson_ws'] = 'import ujson';

    generator.definitions_['web_server_globals'] = `
# --- Global Web Server & WebSocket State ---
_ws_clients = []
_dashboard_state = {}
_web_request_handler = None
_web_html_content = "<h1>Pico W Server</h1><p>Connect via WebSocket to control.</p>"
`;

    const funcName = 'start_web_and_ws_server';
    if (!generator.functionNames_[funcName]) {

generator.functionNames_['ws_helpers'] = `
def _ws_callback(client, msg):
    global _dashboard_state
    try:
        data = ujson.loads(msg)
        if 'id' in data:
            component_id = data['id']
            if 'value' in data:
                try:
                    _dashboard_state[component_id] = int(data['value'])
                except (ValueError, TypeError):
                    _dashboard_state[component_id] = data['value']
            if 'y' in data:
                 _dashboard_state[component_id + '_y'] = int(data['y'])
            for c in _ws_clients:
                if c is not client:
                    try: c.send(msg)
                    except Exception: pass
    except (ValueError, KeyError) as e:
        print("Received invalid ws message:", e)

def send_to_dashboard(component_id, prop, value):
    msg = ujson.dumps({"id": component_id, "prop": prop, "value": value})
    for client in _ws_clients:
        try: client.send(msg)
        except Exception: pass
`;

generator.functionNames_[funcName] = `
def _web_server_thread():
    try:
        addr = socket.getaddrinfo('0.0.0.0', 80)[0][-1]
        s = socket.socket()
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(addr)
        s.listen(5)
        print('Web server listening on port 80')
        
        def _ws_client_thread(ws):
            try:
                ws.serve_forever()
            finally:
                if ws in _ws_clients:
                    _ws_clients.remove(ws)
                print("WebSocket client disconnected.")

        while True:
            cl = None
            try:
                cl, addr = s.accept()
                request_bytes = cl.recv(1024)
                if not request_bytes:
                    cl.close()
                    continue
                
                request_str = request_bytes.decode('utf-8', 'ignore')
                
                if "Upgrade: websocket" in request_str:
                    print("Accepting WebSocket connection...")
                    ws_server = websocket_server.WsServer(cl, on_message=_ws_callback, request_str=request_str)
                    _ws_clients.append(ws_server)
                    _thread.start_new_thread(_ws_client_thread, (ws_server,))
                    continue

                if callable(_web_request_handler):
                    _web_request_handler()
                
                response = 'HTTP/1.1 200 OK\\r\\nContent-Type: text/html\\r\\nConnection: close\\r\\n\\r\\n' + str(_web_html_content)
                cl.sendall(response.encode('utf-8'))
                cl.close()
            except OSError as e:
                if cl: cl.close()
            except Exception as e:
                if cl: cl.close()
                print('Web server error:', e)
    except Exception as e:
        print('Web server fatal error:', e)

def ${funcName}():
    if _wlan and _wlan.isconnected():
        try:
            _thread.start_new_thread(_web_server_thread, ())
            print("Web server thread started.")
        except Exception as e:
            print("Failed to start web server thread:", e)
    else:
        print("Wi-Fi not connected. Web server not started.")
`;
    }
    return `${funcName}()\n`;
};

generator.forBlock['wifi_on_web_request'] = function(block) {
    if (block.generatedFuncName) {
        return `_web_request_handler = ${block.generatedFuncName}\n`;
    }
    const statements_do = generator.statementToCode(block, 'DO') || `${generator.INDENT}pass\n`;
    const funcName = generator.nameDB_.getDistinctName('on_web_request', 'PROCEDURE');
    block.generatedFuncName = funcName; 
    const func = `def ${funcName}():\n${generator.INDENT}global _web_html_content\n${statements_do}`;
    generator.functionNames_[funcName] = func;
    return `_web_request_handler = ${funcName}\n`;
};

generator.forBlock['wifi_send_web_response'] = function(block) {
    const html = generator.valueToCode(block, 'HTML', 0) || '""';
    return `_web_html_content = str(${html})\n`;
};

generator.forBlock['wifi_get_web_request_path'] = function(block) {
    return ['"/"', generator.ORDER_ATOMIC];
};

// --- Bluetooth LE Generators ---
generator.forBlock['ble_setup'] = function(block) {
    generator.definitions_['import_bluetooth'] = 'import ubluetooth';
    generator.definitions_['import_struct'] = 'import struct';
    const name = generator.valueToCode(block, 'NAME', 0) || '"PicoW"';
    const funcName = 'ble_setup_advertising';
    if (!generator.functionNames_[funcName]) {
        generator.functionNames_[funcName] = `
ble = ubluetooth.BLE()
ble.active(True)
_adv_name = ""
def _ble_compose_adv_payload(name, data_str):
    global _adv_name
    if name: _adv_name = name
    payload = bytearray(b'\\x02\\x01\\x06')
    name_bytes = _adv_name.encode()
    payload += struct.pack('B', len(name_bytes) + 1) + b'\\t' + name_bytes
    if data_str: payload += struct.pack('B', len(str(data_str)) + 1) + b'\\xff' + str(data_str).encode()
    return payload
def ${funcName}(name): ble.gap_advertise(100000, adv_data=_ble_compose_adv_payload(name, None))
${funcName}(${name})
`;
    }
    return '';
};

generator.forBlock['ble_advertise_data'] = (b) => `ble.gap_advertise(100000, adv_data=_ble_compose_adv_payload(None, ${generator.valueToCode(b, 'DATA', 0) || '""'}))\n`;


generator.forBlock['async_sleep_ms'] = function(block) {
    generator.definitions_['import_asyncio'] = 'import uasyncio as asyncio';
    const ms = generator.valueToCode(block, 'MS', 0) || '0';
    return `await asyncio.sleep_ms(${ms})\n`;
};

generator.forBlock['gpio_on_pin_change'] = function(block) {
    ensureMachineImport();
    const pinNum = block.getFieldValue('PIN');
    const trigger = block.getFieldValue('TRIGGER');
    const statements_do = generator.statementToCode(block, 'DO') || generator.INDENT + 'pass\n';
    
    const funcName = generator.nameDB_.getDistinctName(`on_pin_${pinNum}_irq`, 'PROCEDURE');
    
    const func = `def ${funcName}(pin):\n${statements_do}`;
    generator.functionNames_[funcName] = func;

    generator.definitions_[`pin_irq_${pinNum}`] = `pin_${pinNum} = Pin(${pinNum}, Pin.IN, Pin.PULL_UP)`;
    generator.definitions_[`irq_handler_${pinNum}`] = `pin_${pinNum}.irq(trigger=Pin.${trigger}, handler=${funcName})`;

    return ''; // This is a setup block, it doesn't generate inline code.
};

generator.forBlock['async_run_main_loop'] = (b) => '';

}