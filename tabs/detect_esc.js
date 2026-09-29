'use strict';

TABS.detect_esc = {};
TABS.detect_esc.detected = null; // { layout, mcu, name, mainRev, subRev, layoutRev } after Detect

// Read raw EEPROM image over the 4-way link. Resolves Uint8Array or throws.
function deReadEeprom(offset, length) {
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

function deAscii(bytes) {
    return String.fromCharCode.apply(null, bytes).replace(/\s+$/g, '');
}

TABS.detect_esc.initialize = function (callback) {
    var self = this;

    if (GUI.active_tab !== 'detect_esc') {
        GUI.active_tab = 'detect_esc';
        if (typeof googleAnalytics !== 'undefined') {
            googleAnalytics.sendAppView('DetectEsc');
        }
    }

    $('#content').load('./tabs/detect_esc.html', function () {
        localize();

        function log(msg) {
            GUI.log('DetectEsc: ' + msg);
        }

        function setCheckRow(name, state, detail) {
            var $tbody = $('#de-checks-table tbody');
            var $row = $tbody.find('tr[data-check="' + name + '"]');
            if (!$row.length) {
                $row = $('<tr/>', { 'data-check': name })
                    .append($('<td/>').text(name))
                    .append($('<td/>', { 'class': 'de-state' }))
                    .append($('<td/>', { 'class': 'de-detail' }));
                $tbody.append($row);
            }
            $row.find('.de-state').text(state);
            $row.find('.de-detail').html(detail);
            $row.attr('class', 'de-' + state.toLowerCase());
        }

        function requireLink() {
            if (!CONFIGURATOR.connectionValid || !CONFIGURATOR.escActive) {
                throw new Error('not connected — Connect first (FC or interface box)');
            }
        }

        function isDeprecatedLayout(layout) {
            return !!layout && layout.toUpperCase().indexOf('L_') === 0;
        }

        $('#de-detect').on('click', function (e) {
            e.preventDefault();
            try {
                requireLink();
            } catch (err) {
                $('#de-detect-out').html(err.message);
                return;
            }
            $('#de-detect-out').html('reading ESC EEPROM...');
            deReadEeprom(BLHELI_SILABS_EEPROM_OFFSET, BLHELI_LAYOUT_SIZE).then(function (img) {
                var layout = deAscii(img.subarray(BLHELI_LAYOUT.LAYOUT.offset, BLHELI_LAYOUT.LAYOUT.offset + BLHELI_LAYOUT.LAYOUT.size)).trim();
                var mcu = deAscii(img.subarray(BLHELI_LAYOUT.MCU.offset, BLHELI_LAYOUT.MCU.offset + BLHELI_LAYOUT.MCU.size));
                var name = deAscii(img.subarray(BLHELI_LAYOUT.NAME.offset, BLHELI_LAYOUT.NAME.offset + BLHELI_LAYOUT.NAME.size));
                var mainRev = img[BLHELI_LAYOUT.MAIN_REVISION.offset];
                var subRev = img[BLHELI_LAYOUT.SUB_REVISION.offset];
                var layoutRev = img[BLHELI_LAYOUT.LAYOUT_REVISION.offset];
                TABS.detect_esc.detected = { layout: layout, mcu: mcu, name: name, mainRev: mainRev, subRev: subRev, layoutRev: layoutRev };
                var extra = isDeprecatedLayout(layout)
                    ? '<p>L layout (BB10) is deprecated upstream — cap firmware at <code>0.18.1</code>.</p>'
                    : '';
                $('#de-detect-out').html(
                    '<p><strong>LAYOUT:</strong> <code>' + layout + '</code> ' +
                    '<strong>MCU:</strong> <code>' + mcu + '</code> ' +
                    '<strong>NAME:</strong> <code>' + name + '</code></p>' +
                    '<p><strong>MAIN/SUB/LAYOUT rev:</strong> <code>' + mainRev + ' / ' + subRev + ' / ' + layoutRev + '</code></p>' +
                    extra
                );
                log('detected LAYOUT=<code>' + layout + '</code> MCU=<code>' + mcu + '</code>');
            }).catch(function (err) {
                $('#de-detect-out').html('detect failed: ' + err.message);
            });
        });

        $('#de-checks').on('click', function (e) {
            e.preventDefault();
            $('#de-checks-table tbody').empty();
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
                return deReadEeprom(BLHELI_SILABS_EEPROM_OFFSET, BLHELI_LAYOUT_SIZE);
            }).then(function (img) {
                setCheckRow('EEPROM readable', 'PASS', BLHELI_LAYOUT_SIZE + ' bytes @ 0x' + BLHELI_SILABS_EEPROM_OFFSET.toString(16));
                var layoutRev = img[BLHELI_LAYOUT.LAYOUT_REVISION.offset];
                if (layoutRev >= BLHELI_MIN_SUPPORTED_LAYOUT_REVISION) {
                    setCheckRow('Layout revision', 'PASS', 'rev ' + layoutRev + ' >= min ' + BLHELI_MIN_SUPPORTED_LAYOUT_REVISION);
                } else {
                    setCheckRow('Layout revision', 'FAIL', 'rev ' + layoutRev + ' < min ' + BLHELI_MIN_SUPPORTED_LAYOUT_REVISION + ' — unsupported bootloader/layout');
                }
                var mcu = deAscii(img.subarray(BLHELI_LAYOUT.MCU.offset, BLHELI_LAYOUT.MCU.offset + BLHELI_LAYOUT.MCU.size));
                var name = deAscii(img.subarray(BLHELI_LAYOUT.NAME.offset, BLHELI_LAYOUT.NAME.offset + BLHELI_LAYOUT.NAME.size));
                if (mcu && name) {
                    setCheckRow('MCU / NAME present', 'PASS', 'MCU=<code>' + mcu + '</code> NAME=<code>' + name + '</code>');
                } else {
                    setCheckRow('MCU / NAME present', 'WARN', 'blank strings — EEPROM may be erased or unreadable');
                }
                var layout = deAscii(img.subarray(BLHELI_LAYOUT.LAYOUT.offset, BLHELI_LAYOUT.LAYOUT.offset + BLHELI_LAYOUT.LAYOUT.size)).trim();
                if (!layout) {
                    setCheckRow('ESC layout', 'WARN', 'blank LAYOUT — EEPROM may be erased');
                } else if (isDeprecatedLayout(layout)) {
                    setCheckRow('ESC layout', 'WARN', 'ESC=<code>' + layout + '</code> — L/BB10 deprecated upstream, cap firmware at <code>0.18.1</code>');
                } else {
                    setCheckRow('ESC layout', 'PASS', 'ESC=<code>' + layout + '</code>');
                }
                // 6. bootloader region sanity: first bytes of bootloader area should not be all 0xFF on a flashed ESC
                return deReadEeprom(BLHELI_SILABS_BOOTLOADER_ADDRESS, 16).then(function (bl) {
                    var erased = true;
                    for (var i = 0; i < bl.length; i++) {
                        if (bl[i] !== 0xFF) {
                            erased = false;
                            break;
                        }
                    }
                    setCheckRow('Bootloader present', erased ? 'WARN' : 'PASS', erased ? 'bootloader area reads erased — recovery may need C2' : 'bootloader area responds');
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
                $('#de-detect-out').html('Active interface: <code>' + label + '</code>. Change it in the Select Interface tab. Reads LAYOUT / MCU / NAME from ESC EEPROM.');
            });
        } catch (err) { /* keep default text */ }

        GUI.content_ready(callback);
    });
};

TABS.detect_esc.cleanup = function (callback) {
    if (callback) {
        callback();
    }
};
