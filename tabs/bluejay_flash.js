'use strict';

TABS.bluejay_flash = {};
TABS.bluejay_flash.loaded = null; // { url, text, parsed, layout, version } after Load Firmware (Online)

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

        var bjVersionsCache = [];
        var bjLayoutsCache = {};

        function log(msg) {
            GUI.log('BluejayFlash: ' + msg);
        }

        // Strictly local: version/layout lists come from the shipped
        // js/bluejay_versions.json + js/bluejay_escs.json only (no remote
        // override), so the bird-sanctuary URLs in our files are what you get.
        function fetchLocalJson(localUrl) {
            return fetch(localUrl).then(function (response) {
                if (!response.ok) {
                    throw new Error(response.statusText);
                }
                return response.json();
            });
        }

        function refreshBluejayPickers() {
            var $ver = $('#bj-version');
            var $lay = $('#bj-layout');
            $ver.empty();
            $lay.empty();
            $ver.append($('<option/>', { value: '', text: 'loading...' }));
            $lay.append($('<option/>', { value: '', text: 'loading...' }));
            fetchLocalJson(BLUEJAY_VERSIONS_LOCAL).then(function (json) {
                bjVersionsCache = (json && json.EFM8) || [];
                $ver.empty();
                bjVersionsCache.forEach(function (v) {
                    $ver.append($('<option/>', { value: v.key, text: v.name }));
                });
                refreshBluejayUrl();
            }).catch(function () {
                $ver.empty();
            });
            fetchLocalJson(BLUEJAY_ESCS_LOCAL).then(function (json) {
                bjLayoutsCache = (json && json.layouts && json.layouts.EFM8) || {};
                $lay.empty();
                Object.keys(bjLayoutsCache).sort().forEach(function (k) {
                    var clean = k.replace(/#/g, '');
                    $lay.append($('<option/>', { value: clean, text: clean + ' (' + bjLayoutsCache[k].name + ')' }));
                });
                if (bjLayoutsCache['#J_L_30#']) {
                    $lay.val('J_L_30');
                }
                refreshBluejayUrl();
            }).catch(function () {
                $lay.empty();
            });
            refreshBluejayUrl();
        }

        function bluejayVersionEntry() {
            var key = $('#bj-version').val();
            var found = null;
            (bjVersionsCache || []).forEach(function (v) {
                if (v.key === key) {
                    found = v;
                }
            });
            return found;
        }

        function refreshBluejayUrl() {
            var base = $('#bj-layout').val() || 'J_L_30';
            var suffix = ($('#bj-suffix').val() || '').trim();
            if (suffix) {
                base = base + '_' + suffix;
            }
            $('#bj-url').val(makeInterfacesBluejayUrl(bluejayVersionEntry(), base));
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

        $('#bj-version').on('change', refreshBluejayUrl);
        $('#bj-layout').on('change', refreshBluejayUrl);
        $('#bj-suffix').on('input change', refreshBluejayUrl);

        $('#bj-copy').on('click', function (e) {
            e.preventDefault();
            refreshBluejayUrl();
            $('#bj-url').select();
            try {
                document.execCommand('copy');
                log('URL copied');
            } catch (err) {
                log('copy failed — select the URL manually');
            }
        });

        $('#bj-download').on('click', function (e) {
            e.preventDefault();
            refreshBluejayUrl();
            var url = $('#bj-url').val();
            var entry = bluejayVersionEntry();
            var base = ($('#bj-layout').val() || '') + (($('#bj-suffix').val() || '').trim() ? '_' + ($('#bj-suffix').val() || '').trim() : '');
            if (!url || !entry) {
                log('pick a version + layout first');
                return;
            }
            var cacheKey = 'bj_' + entry.key + '_' + base;
            $('#bj-loaded').html('loading <code>' + url + '</code> ...');
            getFromCache(cacheKey, url).then(function (text) {
                if (!text || text.charAt(0) !== ':') {
                    throw new Error('not an Intel HEX file (bad content at ' + url + ')');
                }
                return parseHex(text).then(function (parsed) {
                    TABS.bluejay_flash.loaded = { url: url, text: text, parsed: parsed, layout: $('#bj-layout').val(), version: entry.key };
                    var blocks = (parsed && parsed.data) ? parsed.data.length : 0;
                    $('#bj-loaded').html('loaded <code>' + base + '_v' + entry.key + '.hex</code> — ' +
                        text.split('\n').length + ' lines, ' + blocks + ' blocks. Held in memory for the flash step.');
                    log('firmware loaded online: <code>' + url + '</code>');
                });
            }).catch(function (err) {
                $('#bj-loaded').html('load failed: ' + err.message);
                log('online load failed: ' + err.message);
            });
        });

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
                var layout = bjFlashAscii(img.subarray(BLHELI_LAYOUT.LAYOUT.offset, BLHELI_LAYOUT.LAYOUT.offset + BLHELI_LAYOUT.LAYOUT.size));
                var mcu = bjFlashAscii(img.subarray(BLHELI_LAYOUT.MCU.offset, BLHELI_LAYOUT.MCU.offset + BLHELI_LAYOUT.MCU.size));
                var name = bjFlashAscii(img.subarray(BLHELI_LAYOUT.NAME.offset, BLHELI_LAYOUT.NAME.offset + BLHELI_LAYOUT.NAME.size));
                var mainRev = img[BLHELI_LAYOUT.MAIN_REVISION.offset];
                var subRev = img[BLHELI_LAYOUT.SUB_REVISION.offset];
                var layoutRev = img[BLHELI_LAYOUT.LAYOUT_REVISION.offset];
                $('#bj-detect-out').html(
                    '<p><strong>LAYOUT:</strong> <code>' + layout + '</code> ' +
                    '<strong>MCU:</strong> <code>' + mcu + '</code> ' +
                    '<strong>NAME:</strong> <code>' + name + '</code></p>' +
                    '<p><strong>MAIN/SUB/LAYOUT rev:</strong> <code>' + mainRev + ' / ' + subRev + ' / ' + layoutRev + '</code></p>'
                );
                // Preselect matching layout picker entry when the ESC names one we know
                var guess = null;
                Object.keys(bjLayoutsCache).forEach(function (k) {
                    var clean = k.replace(/#/g, '');
                    if (layout && clean.indexOf(layout.trim()) === 0) {
                        guess = clean;
                    }
                });
                if (guess) {
                    $('#bj-layout').val(guess);
                    refreshBluejayUrl();
                    log('layout picker set to <code>' + guess + '</code> from ESC');
                } else {
                    log('ESC reports LAYOUT=<code>' + layout + '</code> — no exact picker match, check manually');
                }
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
                setCheckRow('Layout matches picker', 'SKIP', 'no link');
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
                var picked = ($('#bj-layout').val() || '').trim();
                if (layout && picked && picked.indexOf(layout) === 0) {
                    setCheckRow('Layout matches picker', 'PASS', 'ESC=<code>' + layout + '</code> picker=<code>' + picked + '</code>');
                } else {
                    setCheckRow('Layout matches picker', 'WARN', 'ESC=<code>' + (layout || '?') + '</code> picker=<code>' + (picked || '?') + '</code> — confirm before flashing');
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

        refreshBluejayPickers();

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
