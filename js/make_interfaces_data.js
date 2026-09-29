'use strict';

// Make Interfaces data — interface maker pack (Arduino boxes + SiLabs wiring).
// Covers ALL Arduino boards in the pack + ALL SiLabs direct interfaces.
// BLHeli boxes (ModBoxes4w-if RBBX/TAQX/TDLX, ATMega4w-if) intentionally excluded.
// ESC flash logic is NOT touched here.

var MAKE_INTERFACES = {
    avrdudeVersion: '5.11.1 (bundled, see interfaces/avrdude/)',
    avrdudeDir: 'interfaces/avrdude',

    // Every Arduino board supported for interface making.
    // boardKey matches the hex-file naming used by the pack. mcu/programmer/baud
    // match the classic AvrDude_Make_ISP_*.bat style lines.
    boards: [
        { key: 'Uno',            label: 'Arduino Uno (ATmega328P)',        mcu: 'm328p', programmer: 'arduino', baud: 115200 },
        { key: 'Nano_328',       label: 'Arduino Nano ATmega328',          mcu: 'm328p', programmer: 'arduino', baud: 115200 },
        { key: 'Nano_328_old',   label: 'Arduino Nano ATmega328 (old bootloader)', mcu: 'm328p', programmer: 'arduino', baud: 57600 },
        { key: 'Nano_168',       label: 'Arduino Nano ATmega168',          mcu: 'm168',  programmer: 'arduino', baud: 19200 },
        { key: 'Mini_328',       label: 'Arduino Mini ATmega328',          mcu: 'm328p', programmer: 'arduino', baud: 115200 },
        { key: 'Mini_168',       label: 'Arduino Mini ATmega168',          mcu: 'm168',  programmer: 'arduino', baud: 19200 },
        { key: 'ProMini_328_16', label: 'Pro Mini 5V/16MHz ATmega328',     mcu: 'm328p', programmer: 'arduino', baud: 57600 },
        { key: 'ProMini_328_8',  label: 'Pro Mini 3.3V/8MHz ATmega328',    mcu: 'm328p', programmer: 'arduino', baud: 57600 },
        { key: 'ProMini_168_16', label: 'Pro Mini 16MHz ATmega168',        mcu: 'm168',  programmer: 'arduino', baud: 19200 },
        { key: 'ProMini_168_8',  label: 'Pro Mini 8MHz ATmega168',         mcu: 'm168',  programmer: 'arduino', baud: 19200 },
        { key: 'Mega_2560',      label: 'Arduino Mega 2560 (ATmega2560)',  mcu: 'm2560', programmer: 'wiring',  baud: 115200 },
        { key: 'Mega_1280',      label: 'Arduino Mega 1280 (ATmega1280)',  mcu: 'm1280', programmer: 'wiring',  baud: 115200 },
        { key: 'm168_16',        label: 'ATmega168 @16MHz (breadboard)',   mcu: 'm168',  programmer: 'arduino', baud: 19200 },
        { key: 'm168_8',         label: 'ATmega168 @8MHz (breadboard)',    mcu: 'm168',  programmer: 'arduino', baud: 19200 },
        { key: 'm328P_16',       label: 'ATmega328P @16MHz (breadboard)',  mcu: 'm328p', programmer: 'arduino', baud: 115200 },
        { key: 'm328P_8',        label: 'ATmega328P @8MHz (breadboard)',   mcu: 'm328p', programmer: 'arduino', baud: 57600 },
        { key: 'm88_16',         label: 'ATmega88 @16MHz (breadboard)',    mcu: 'm88',   programmer: 'arduino', baud: 19200 },
        { key: 'm88_8',          label: 'ATmega88 @8MHz (breadboard)',     mcu: 'm88',   programmer: 'arduino', baud: 19200 },
        { key: 'Dieci_Due_168',  label: 'Diecimila/Duemilanove ATmega168', mcu: 'm168',  programmer: 'arduino', baud: 19200 },
        { key: 'NG_168',         label: 'Arduino NG ATmega168',            mcu: 'm168',  programmer: 'arduino', baud: 19200 },
        { key: 'NG_m8',          label: 'Arduino NG ATmega8',              mcu: 'm8',    programmer: 'arduino', baud: 19200 },
        { key: 'BT_328',         label: 'Arduino BT ATmega328',            mcu: 'm328p', programmer: 'arduino', baud: 19200 },
        { key: 'BT_168',         label: 'Arduino BT ATmega168',            mcu: 'm168',  programmer: 'arduino', baud: 19200 },
        { key: 'LilyPad_328',    label: 'LilyPad ATmega328',               mcu: 'm328p', programmer: 'arduino', baud: 57600 },
        { key: 'LilyPad_168',    label: 'LilyPad ATmega168',               mcu: 'm168',  programmer: 'arduino', baud: 19200 },
        { key: 'Fio',            label: 'Arduino Fio',                     mcu: 'm328p', programmer: 'arduino', baud: 57600 },
        { key: 'Ethernet',       label: 'Arduino Ethernet',                mcu: 'm328p', programmer: 'arduino', baud: 115200 },
        { key: 'Due_328',        label: 'Arduino Due (ATmega328 build)',   mcu: 'm328p', programmer: 'arduino', baud: 115200 }
    ],

    baudRates: [115200, 57600, 19200],

    // Interface firmwares (= "Make ..." pack entries). File names must
    // exist under interfaces/<dir>/. Every entry lists which boardKeys it fits.
    firmwares: {
        'arduino-4w-if': {
            title: 'Arduino 4w-if (4-way-interface box)',
            dir: 'interfaces/arduino-4w-if',
            description: '4-way bridge. PC <-> 4-way protocol <-> SiLC2 / SiLBLB to the SiLabs ESC. This is the "Make Arduino 4w-if" pack entry.',
            silabsModes: ['SiLC2 (C2 direct)', 'SiLBLB (SiLabs bootloader 1-wire)'],
            files: [
                { file: '4wArduino_m1280_16_MULTIv20006.hex',        boards: ['Mega_1280'] },
                { file: '4wArduino_m1280_16_PB2PB3v20006.hex',       boards: ['Mega_1280'] },
                { file: '4wArduino_m168___8_MULTIv20006.hex',        boards: ['Nano_168', 'Mini_168', 'ProMini_168_8', 'm168_8', 'Dieci_Due_168', 'NG_168'] },
                { file: '4wArduino_m168___8_PB3PB4v20006.hex',       boards: ['Nano_168', 'Mini_168', 'ProMini_168_8', 'm168_8', 'Dieci_Due_168', 'NG_168'] },
                { file: '4wArduino_m168__16_MULTIv20006.hex',        boards: ['Nano_168', 'Mini_168', 'ProMini_168_16', 'm168_16', 'Dieci_Due_168', 'NG_168'] },
                { file: '4wArduino_m168__16_PB3PB4v20006.hex',       boards: ['Nano_168', 'Mini_168', 'ProMini_168_16', 'm168_16', 'Dieci_Due_168', 'NG_168'] },
                { file: '4wArduino_m2560_16_ARDU_PF1PF0v20006.hex',  boards: ['Mega_2560'] },
                { file: '4wArduino_m2560_16_MULTIv20006.hex',        boards: ['Mega_2560'] },
                { file: '4wArduino_m2560_16_PB2PB3v20006.hex',       boards: ['Mega_2560'] },
                { file: '4wArduino_m2560_16_PB3PB4v20006.hex',       boards: ['Mega_2560'] },
                { file: '4wArduino_m328P__8_MULTIv20006.hex',        boards: ['ProMini_328_8', 'm328P_8'] },
                { file: '4wArduino_m328P__8_PB3PB4v20006.hex',       boards: ['ProMini_328_8', 'm328P_8'] },
                { file: '4wArduino_m328P_16_MULTIv20006.hex',        boards: ['Uno', 'Nano_328', 'Nano_328_old', 'Mini_328', 'ProMini_328_16', 'm328P_16', 'Ethernet', 'Due_328', 'Fio'] },
                { file: '4wArduino_m328P_16_PB3PB4v20006.hex',       boards: ['Uno', 'Nano_328', 'Nano_328_old', 'Mini_328', 'ProMini_328_16', 'm328P_16', 'Ethernet', 'Due_328', 'Fio'] },
                { file: '4wArduino_m88___16_MULTIv20003.hex',        boards: ['m88_16'] },
                { file: '4wArduino_m88___16_PB3PB4v20006.hex',       boards: ['m88_16'] },
                { file: '4wArduino_m88____8_MULTIv20003.hex',        boards: ['m88_8'] },
                { file: '4wArduino_m88____8_PB3PB4v20006.hex',       boards: ['m88_8'] },
                { file: '4wArduino_Nano__16_MULTIv20006.hex',        boards: ['Nano_328', 'Nano_328_old'] },
                { file: '4wArduino_Nano__16_PB3PB4v20006.hex',       boards: ['Nano_328', 'Nano_328_old'] },
                { file: '4wArduino_Nano__16_PD3PD2v20006.hex',       boards: ['Nano_328', 'Nano_328_old'] },
                { file: '4wArduino_Uno_LCD1602_MULTIv16501.hex',     boards: ['Uno'] },
                { file: '4wArduino_Uno_LCD1602_PB3PB4v16501.hex',    boards: ['Uno'] },
                { file: '4wArduino_Uno_LCD4884_MULTIv16501.hex',     boards: ['Uno'] },
                { file: '4wArduino_Uno_LCD4884_PB3PB4v16501.hex',    boards: ['Uno'] }
            ]
        },
        'arduino-usb-linker': {
            title: 'Arduino USB-Linker (1-wire single ESC)',
            dir: 'interfaces/arduino-usb-linker',
            description: '1-wire bootloader stick for one SiLabs ESC at a time (signal + GND, ESC powered separately). This is the "Make Arduino USB-Linker" pack entry. atmega32u4 boards NOT supported.',
            silabsModes: ['SiLBLB (SiLabs bootloader 1-wire)'],
            files: [
                { file: 'ArduinoUSBLinker_Uno.hex',          boards: ['Uno'] },
                { file: 'ArduinoUSBLinker_Nano_328.hex',     boards: ['Nano_328', 'Nano_328_old'] },
                { file: 'ArduinoUSBLinker_Mini_328.hex',     boards: ['Mini_328'] },
                { file: 'ArduinoUSBLinker_Mini_168.hex',     boards: ['Mini_168'] },
                { file: 'ArduinoUSBLinker_ProMini_328_16.hex', boards: ['ProMini_328_16'] },
                { file: 'ArduinoUSBLinker_ProMini_328_8.hex',  boards: ['ProMini_328_8'] },
                { file: 'ArduinoUSBLinker_ProMini_168_16.hex', boards: ['ProMini_168_16'] },
                { file: 'ArduinoUSBLinker_ProMini_168_8.hex',  boards: ['ProMini_168_8'] },
                { file: 'ArduinoUSBLinker_Mega_1280.hex',    boards: ['Mega_1280'] },
                { file: 'ArduinoUSBLinker_Mega_2560_ADK.hex', boards: ['Mega_2560'] },
                { file: 'ArduinoUSBLinker_BT_328.hex',       boards: ['BT_328'] },
                { file: 'ArduinoUSBLinker_BT_168.hex',       boards: ['BT_168'] },
                { file: 'ArduinoUSBLinker_Due_328.hex',      boards: ['Due_328'] },
                { file: 'ArduinoUSBLinker_Ethernet.hex',     boards: ['Ethernet'] },
                { file: 'ArduinoUSBLinker_Fio.hex',          boards: ['Fio'] },
                { file: 'ArduinoUSBLinker_LilyPad_328.hex',  boards: ['LilyPad_328'] },
                { file: 'ArduinoUSBLinker_LilyPad_168.hex',  boards: ['LilyPad_168'] },
                { file: 'ArduinoUSBLinker_NG_168.hex',       boards: ['NG_168'] },
                { file: 'ArduinoUSBLinker_NG_m8.hex',        boards: ['NG_m8'] }
            ]
        },
        'arduino-1wire': {
            title: 'Arduino 1-Wire (legacy single-wire)',
            dir: 'interfaces/arduino-1wire',
            description: 'Older single-wire Arduino bridge. Prefer 4w-if or USB-Linker for SiLabs unless you need this exact variant.',
            silabsModes: ['SiLBLB (SiLabs bootloader 1-wire)'],
            files: [
                { file: 'Arduino1Wire_Uno.hex',           boards: ['Uno'] },
                { file: 'Arduino1Wire_Nano_328.hex',      boards: ['Nano_328', 'Nano_328_old'] },
                { file: 'Arduino1Wire_Nano_168.hex',      boards: ['Nano_168'] },
                { file: 'Arduino1Wire_Mega_2560_ADK.hex', boards: ['Mega_2560'] },
                { file: 'Arduino1Wire_PB3_328.hex',       boards: ['Nano_328', 'Uno', 'ProMini_328_16'] },
                { file: 'Arduino1Wire_PB3_168.hex',       boards: ['Nano_168', 'ProMini_168_16'] }
            ]
        }
    },

    // Back-compat alias used by older tab code.
    families: {},

    // ALL SiLabs ESC-side interfaces (shown in the Select Interface tab).
    silabsInterfaces: [
        {
            id: 'toolstick-c2',
            suiteLabel: 'ToolStick / USB Debug Adapter (C2)',
            name: 'SiLabs ToolStick / USB Debug Adapter (C2)',
            escSignals: 'C2D + C2CK + GND (+ optional 5V)',
            useFor: 'Direct C2 flash + recovery of EFM8BB10/BB21/BB51. No bootloader needed.',
            baud: 'n/a (USB debug)',
            docs: ['BLHeli programming adapters.pdf', 'BLHeli_S manual SiLabs Rev16.x.pdf']
        },
        {
            id: 'uart-1wire',
            suiteLabel: 'USB-UART bootloader stick COM (1-wire)',
            name: 'USB-UART bootloader stick (1-wire)',
            escSignals: 'ESC signal + GND (ESC powered separately)',
            useFor: 'SiLBLB bootloader read/write via 1-wire. Cheap CP2102/CH340 build.',
            baud: '19200 (bootloader)',
            docs: ['How to Build a BLHeli bootloader interface with USB-UART board.pdf', 'BLHeli programming adapters.pdf']
        },
        {
            id: 'arduino-4wif-silc2',
            suiteLabel: 'Arduino 4w-if COM — SiLC2 mode (C2 via Arduino)',
            name: 'Arduino 4w-if in SiLC2 mode (C2 via Arduino)',
            escSignals: 'Per 4w-if pinout PDF (MULTI / PB3PB4 / PB2PB3 / PD3PD2 variant)',
            useFor: 'C2 through the Arduino box. Flash Arduino with an arduino-4w-if hex first.',
            baud: '19200 (4w-if link)',
            docs: ['BLHeliSuite 4w-if interfaces pinout.pdf', 'BLHeliSuite 4w-if protocol.pdf']
        },
        {
            id: 'arduino-4wif-siblb',
            suiteLabel: 'Arduino 4w-if COM — SiLBLB mode (bootloader via Arduino)',
            name: 'Arduino 4w-if in SiLBLB mode (bootloader via Arduino)',
            escSignals: 'ESC signal + GND (ESC powered separately)',
            useFor: 'Bootloader 1-wire through the Arduino box. Most common Bluejay path.',
            baud: '19200 (4w-if link)',
            docs: ['BLHeliSuite 4w-if interfaces pinout.pdf', 'BLHeliSuite 4w-if protocol.pdf']
        },
        {
            id: 'arduino-usb-linker-1wire',
            suiteLabel: 'Arduino USB-Linker COM (1-wire single ESC)',
            name: 'Arduino USB-Linker (1-wire single ESC)',
            escSignals: 'ESC signal + GND (ESC powered separately)',
            useFor: 'One ESC at a time, no FC. Flash Arduino with an arduino-usb-linker hex first.',
            baud: '19200 (linker)',
            docs: ['Readme ArduinoUSBLinker.txt (in interfaces/arduino-usb-linker/)']
        },
        {
            id: 'fc-passthrough',
            suiteLabel: 'FC passthrough (default)',
            name: 'FC passthrough (default, already in configurator)',
            escSignals: 'ESC signal to FC motor output, FC over USB',
            useFor: 'What this configurator already does via MSP_SET_4WAY_IF. Listed here for completeness.',
            baud: '115200 (FC USB)',
            docs: []
        }
    ],

    pinoutNotes: [
        { variant: 'MULTI',           meaning: 'Multi-output box build (up to 4 ESCs). See pinout PDF page for MULTI.' },
        { variant: 'PB3PB4',          meaning: 'Signal on PB3/PB4 group. See pinout PDF for your board.' },
        { variant: 'PB2PB3',          meaning: 'Signal on PB2/PB3 group (m1280/m2560 builds). See pinout PDF.' },
        { variant: 'PD3PD2',          meaning: 'Nano signal on PD3/PD2. See pinout PDF.' },
        { variant: 'ARDU_PF1PF0',     meaning: 'Mega ARDU build on PF1/PF0. See pinout PDF.' },
        { variant: 'C2 (SiLC2)',      meaning: 'C2D + C2CK + GND to ESC C2 pads. Check programming adapters PDF before powering.' },
        { variant: '1-wire (SiLBLB)', meaning: 'Single signal wire + GND. ESC powered from battery/BEC. Props off.' }
    ],

    docsDir: 'interfaces/docs-silabs',
    docsFiles: [
        'BLHeliSuite 4w-if interfaces pinout.pdf',
        'BLHeliSuite 4w-if protocol.pdf',
        'How to Build a BLHeli bootloader interface with USB-UART board.pdf',
        'BLHeli programming adapters.pdf',
        'BLHeli_S manual SiLabs Rev16.x.pdf'
    ],
    screenshotsDir: 'interfaces/screenshots',
    screenshotsFiles: [
        'BLHeliSuiteSiLabs ESC Setup_260921_1.png'
    ],

    bluejayRepo: 'https://github.com/bird-sanctuary/bluejay',
    bluejayReleases: 'https://github.com/bird-sanctuary/bluejay/releases'
};

// Look up a board profile by key.
function makeInterfacesFindBoard(boardKey) {
    for (var i = 0; i < MAKE_INTERFACES.boards.length; i++) {
        if (MAKE_INTERFACES.boards[i].key === boardKey) {
            return MAKE_INTERFACES.boards[i];
        }
    }
    return MAKE_INTERFACES.boards[0];
}

// Build an avrdude command line for flashing an Arduino interface box.
// Same shape as the classic AvrDude_Make_ISP_*.bat lines.
// Does NOT flash the ESC — only the Arduino that becomes the interface.
function makeInterfacesAvrdudeCommand(hexPath, comPort, boardKey, baudOverride) {
    var board = makeInterfacesFindBoard(boardKey);
    var port = (comPort || 'COMx');
    if (port.indexOf('\\\\.\\') !== 0 && port.indexOf('COM') === 0) {
        port = '\\\\.\\' + port;
    }
    var baud = baudOverride || board.baud;
    return 'avrdude.exe -c ' + board.programmer +
        ' -D -b ' + baud +
        ' -P ' + port +
        ' -p ' + board.mcu +
        ' -u -U flash:w:"' + hexPath + '":i';
}

// Bluejay hex URL from bluejay_versions.json template + layout file base.
// versionEntry = { url: '.../{0}_v0.16.hex' }, layoutBase e.g. 'J_L_30_24'.
function makeInterfacesBluejayUrl(versionEntry, layoutBase) {
    if (!versionEntry || !versionEntry.url) {
        return '';
    }
    return versionEntry.url.replace('{0}', layoutBase);
}
