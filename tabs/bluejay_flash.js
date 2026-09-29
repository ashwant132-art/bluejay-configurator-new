'use strict';

TABS.bluejay_flash = {};
TABS.bluejay_flash.detected = null; // { layout, mcu, name, mainRev, subRev, layoutRev } after Detect

// Read raw EEPROM image over the 4-way link. Resolves Uint8Array or throws.
function bjFlashReadEeprom(offset, length) {
    var chunks = [];
    var addr = offset;
    var remaining = length;
    var chain = Q.resolve();
    while (remaining > 0) {
        (function (a, n) {
            chain = chain.then(function () {
                return _4way.readEEprom(a, n).then(function (msg) {
                    chunks.push({ addr: a, data: msg.params });
                });
            });
        })(addr, Math.min(remaining, 128));
        addr += Math.min(remaining, 128);
        remaining -= Math.min(remaining, 128);
    }
    return chain.then(function () {
        var out = new Uint8Array(length);
        chunks.forEach(function (c) {
            out.set(c.data.slice(0, Math.min(c.data.length, length - (c.addr - offset))), c.addr - offset);
        });
        return out;
    });
}

function bjFlashAscii(bytes) {
    return String.fromCharCode.apply(null, bytes).replace(/\s+$/g, '');
}

TABS.bluejay_flash.initialize = function (callback) {
    var self = this;

    if (GUI.active_tab !== 'bluejay_flash') {
        GUI.active_tab = 'bluejay_flash';
        if (typeof googleAnalytics !== 'undefined') {
            googleAnalytics.sendAppView('BluejayFlash');
        }
    }

    $('#content').load('./tabs/bluejay_flash.html', function () {
        localize();

        function log(msg) {
            GUI.log('BluejayFlash: ' + msg);
        }

        function setCheckRow(name, state, detail) {
            var $tbody = $('#bj-checks-table tbody');
            var $row = $tbody.find('tr[data-check="' + name + '"]');
            if (!$row.length) {
                $row = $('<tr/>', { 'data-check': name })
                    .append($('<td/>').text(name))
                    .append($('<td/>', { 'class': 'bj-state' }))
                    .append($('<td/>', { 'class': 'bj-detail' }));
                $tbody.append($row);
            }
            $row.find('.bj-state').text(state);
            $row.find('.bj-detail').html(detail);
            $row.attr('class', 'bj-' + state.toLowerCase());
        }

        function requireLink() {
            if (!CONFIGURATOR.connectionValid || !CONFIGURATOR.escActive) {
                throw new Error('not connected — Connect first (FC or interface box)');
            }
        }

        function isDeprecatedLayout(layout) {
            return !!layout && layout.toUpperCase().indexOf('L_') === 0;
        }

        $('#bj-detect').on('click', function (e) {
            e.preventDefault();
            try {
                requireLink();
            } catch (err) {
                $('#bj-detect-out').html(err.message);
                return;
            }
            $('#bj-detect-out').html('reading ESC EEPROM...');
            bjFlashReadEeprom(BLHELI_SILABS_EEPROM_OFFSET, BLHELI_LAYOUT_SIZE).then(function (img) {
                var layout = bjFlashAscii(img.subarray(BLHELI_LAYOUT.LAYOUT.offset, BLHELI_LAYOUT.LAYOUT.offset + BLHELI_LAYOUT.LAYOUT.size)).trim();
                var mcu = bjFlashAscii(img.subarray(BLHELI_LAYOUT.MCU.offset, BLHELI_LAYOUT.MCU.offset + BLHELI_LAYOUT.MCU.size));
                var name = bjFlashAscii(img.subarray(BLHELI_LAYOUT.NAME.offset, BLHELI_LAYOUT.NAME.offset + BLHELI_LAYOUT.NAME.size));
                var mainRev = img[BLHELI_LAYOUT.MAIN_REVISION.offset];
                var subRev = img[BLHELI_LAYOUT.SUB_REVISION.offset];
                var layoutRev = img[BLHELI_LAYOUT.LAYOUT_REVISION.offset];
                TABS.bluejay_flash.detected = { layout: layout, mcu: mcu, name: name, mainRev: mainRev, subRev: subRev, layoutRev: layoutRev };
                var extra = isDeprecatedLayout(layout)
                    ? '<p>L layout (BB10) is deprecated upstream — cap firmware at <code>0.18.1</code>.</p>'
                    : '';
                $('#bj-detect-out').html(
                    '<p><strong>LAYOUT:</strong> <code>' + layout + '</code> ' +
                    '<strong>MCU:</strong> <code>' + mcu + '</code> ' +
                    '<strong>NAME:</strong> <code>' + name + '</code></p>' +
                    '<p><strong>MAIN/SUB/LAYOUT rev:</strong> <code>' + mainRev + ' / ' + subRev + ' / ' + layoutRev + '</code></p>' +
                    extra
                );
                log('detected LAYOUT=<code>' + layout + '</code> MCU=<code>' + mcu + '</code>');
            }).catch(function (err) {
                $('#bj-detect-out').html('detect failed: ' + err.message);
            });
        });

        $('input[name="bj-tool"]').on('change', function () {
            var val = $('input[name="bj-tool"]:checked').val();
            try {
                chrome.storage.local.set({ bluejayFlashTool: val });
            } catch (err) { /* ignore */ }
            $('#bj-tool-note').html(val === 'builtin'
                ? 'Uses the app 4-way path (FC passthrough or Arduino box from Make Interfaces).'
                : 'C2 direct via vendor ToolStick software — wiring docs in the pack, flashing manual for now.');
        });
        try {
            chrome.storage.local.get('bluejayFlashTool', function (data) {
                if (data && data.bluejayFlashTool) {
                    $('input[name="bj-tool"][value="' + data.bluejayFlashTool + '"]').prop('checked', true).trigger('change');
                } else {
                    $('input[name="bj-tool"][value="builtin"]').trigger('change');
                }
            });
        } catch (err) {
            $('input[name="bj-tool"][value="builtin"]').trigger('change');
        }

        $('#bj-flash').on('click', function (e) {
            e.preventDefault();
            log('flashing is intentionally disabled — we lock the tool path first, then I wire execution here');
        });

        $('#bj-checks').on('click', function (e) {
            e.preventDefault();
            $('#bj-checks-table tbody').empty();
            // 1. link check
            try {
                requireLink();
            } catch (err) {
                setCheckRow('Link', 'FAIL', err.message);
                setCheckRow('EEPROM readable', 'SKIP', 'no link');
                setCheckRow('Layout revision', 'SKIP', 'no link');
                setCheckRow('MCU / NAME present', 'SKIP', 'no link');
                setCheckRow('ESC layout', 'SKIP', 'no link');
                setCheckRow('Bootloader present', 'SKIP', 'no link');
                return;
            }
            _4way.testAlive().then(function () {
                setCheckRow('Link', 'PASS', '4-way interface answered');
                return bjFlashReadEeprom(BLHELI_SILABS_EEPROM_OFFSET, BLHELI_LAYOUT_SIZE);
            }).then(function (img) {
                setCheckRow('EEPROM readable', 'PASS', BLHELI_LAYOUT_SIZE + ' bytes @ 0x' + BLHELI_SILABS_EEPROM_OFFSET.toString(16));
                var layoutRev = img[BLHELI_LAYOUT.LAYOUT_REVISION.offset];
                if (layoutRev >= BLHELI_MIN_SUPPORTED_LAYOUT_REVISION) {
                    setCheckRow('Layout revision', 'PASS', 'rev ' + layoutRev + ' >= min ' + BLHELI_MIN_SUPPORTED_LAYOUT_REVISION);
                } else {
                    setCheckRow('Layout revision', 'FAIL', 'rev ' + layoutRev + ' < min ' + BLHELI_MIN_SUPPORTED_LAYOUT_REVISION + ' — unsupported bootloader/layout');
                }
                var mcu = bjFlashAscii(img.subarray(BLHELI_LAYOUT.MCU.offset, BLHELI_LAYOUT.MCU.offset + BLHELI_LAYOUT.MCU.size));
                var name = bjFlashAscii(img.subarray(BLHELI_LAYOUT.NAME.offset, BLHELI_LAYOUT.NAME.offset + BLHELI_LAYOUT.NAME.size));
                if (mcu && name) {
                    setCheckRow('MCU / NAME present', 'PASS', 'MCU=<code>' + mcu + '</code> NAME=<code>' + name + '</code>');
                } else {
                    setCheckRow('MCU / NAME present', 'WARN', 'blank strings — EEPROM may be erased or unreadable');
                }
                var layout = bjFlashAscii(img.subarray(BLHELI_LAYOUT.LAYOUT.offset, BLHELI_LAYOUT.LAYOUT.offset + BLHELI_LAYOUT.LAYOUT.size)).trim();
                if (!layout) {
                    setCheckRow('ESC layout', 'WARN', 'blank LAYOUT — EEPROM may be erased');
                } else if (isDeprecatedLayout(layout)) {
                    setCheckRow('ESC layout', 'WARN', 'ESC=<code>' + layout + '</code> — L/BB10 deprecated upstream, cap firmware at <code>0.18.1</code>');
                } else {
                    setCheckRow('ESC layout', 'PASS', 'ESC=<code>' + layout + '</code>');
                }
                // 6. bootloader region sanity: first bytes of bootloader area should not be all 0xFF on a flashed ESC
                return bjFlashReadEeprom(BLHELI_SILABS_BOOTLOADER_ADDRESS, 16).then(function (bl) {
                    var erased = true;
                    for (var i = 0; i < bl.length; i++) {
                        if (bl[i] !== 0xFF) {
                            erased = false;
                            break;
                        }
                    }
                    setCheckRow('Bootloader present', erased ? 'WARN' : 'PASS', erased ? 'bootloader area reads erased — flashing may need C2 recovery' : 'bootloader area responds');
                });
            }).catch(function (err) {
                setCheckRow('Link', 'FAIL', err.message);
            });
        });

        // Show which interface every check below will run through.
        try {
            chrome.storage.local.get('selectedInterface', function (data) {
                var sel = data && data.selectedInterface;
                var label = (sel && sel.id) ? sel.id + ' @ ' + (sel.port || '?') + ' / ' + (sel.baud || '?') : 'fc-passthrough (default)';
                $('#bj-detect-out').html('Active interface: <code>' + label + '</code>. Change it in the Select Interface tab. Reads LAYOUT / MCU / NAME from ESC EEPROM.');
            });
        } catch (err) { /* keep default text */ }

        GUI.content_ready(callback);
    });
};

TABS.bluejay_flash.cleanup = function (callback) {
    if (callback) {
        callback();
    }
};
