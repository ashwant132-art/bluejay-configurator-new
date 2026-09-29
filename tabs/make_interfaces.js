'use strict';

TABS.make_interfaces = {};

// Spawn bundled avrdude when NW.js node integration is available.
// Returns child process or null when running in pure browser/Chrome-app mode.
function miSpawnAvrdude(args, workDir, onData, onExit) {
    try {
        var childProcess = null;
        if (typeof require === 'function') {
            try {
                childProcess = require('child_process');
            } catch (err) {
                childProcess = null;
            }
        } else if (typeof window !== 'undefined' && window.require) {
            childProcess = window.require('child_process');
        }
        if (!childProcess) {
            return null;
        }
        var proc = childProcess.spawn('avrdude.exe', args, { cwd: workDir });
        proc.stdout.on('data', function (d) { onData(String(d)); });
        proc.stderr.on('data', function (d) { onData(String(d)); });
        proc.on('close', function (code) { onExit(code); });
        proc.on('error', function (err) { onData('spawn error: ' + err.message); onExit(-1); });
        return proc;
    } catch (err) {
        return null;
    }
}

TABS.make_interfaces.initialize = function (callback) {
    var self = this;

    if (GUI.active_tab !== 'make_interfaces') {
        GUI.active_tab = 'make_interfaces';
        if (typeof googleAnalytics !== 'undefined') {
            googleAnalytics.sendAppView('MakeInterfaces');
        }
    }

    $('#content').load('./tabs/make_interfaces.html', function () {
        localize();

        var $family = $('#mi-family');
        var $board = $('#mi-board');
        var $hex = $('#mi-hex');
        var $port = $('#mi-port');
        var $baud = $('#mi-baud');
        var $cmd = $('#mi-cmd');
        var $silabs = $('#mi-silabs');
        var $log = $('#mi-flash-log');

        function log(msg) {
            $log.html(msg);
            GUI.log('MakeInterfaces: ' + msg);
        }

        function refreshBoards() {
            $board.empty();
            MAKE_INTERFACES.boards.forEach(function (b) {
                $board.append($('<option/>', { value: b.key, text: b.label }));
            });
        }

        function refreshBauds(defaultBaud) {
            $baud.empty();
            MAKE_INTERFACES.baudRates.forEach(function (b) {
                $baud.append($('<option/>', { value: b, text: b }));
            });
            if (defaultBaud) {
                $baud.val(String(defaultBaud));
            }
        }

        function refreshFamily() {
            var key = $family.val();
            var fam = MAKE_INTERFACES.firmwares[key];
            if (!fam) {
                return;
            }
            var boardKey = $board.val();
            $hex.empty();
            var matching = fam.files.filter(function (entry) {
                return !boardKey || entry.boards.indexOf(boardKey) !== -1;
            });
            var list = matching.length ? matching : fam.files;
            list.forEach(function (entry) {
                $hex.append($('<option/>', { value: entry.file, text: entry.file }));
            });
            $('#mi-family-desc').text(fam.description + ' SiLabs modes: ' + fam.silabsModes.join(', ') + '.');
            $('#mi-hex-count').text(fam.files.length);
            $('#mi-dir').text(fam.dir);
            var board = makeInterfacesFindBoard(boardKey);
            if (board) {
                refreshBauds(board.baud);
            }
            refreshCommand();
        }

        function refreshPorts(preselect) {
            $port.empty();
            $port.append($('<option/>', { value: '', text: '-- select COM port --' }));
            function addPorts(list) {
                (list || []).forEach(function (p) {
                    $port.append($('<option/>', { value: p, text: p }));
                });
                if (preselect) {
                    $port.val(preselect);
                }
                refreshCommand();
            }
            try {
                if (typeof serial !== 'undefined' && serial.getDevices) {
                    serial.getDevices(function (ports) {
                        addPorts(ports);
                    });
                } else {
                    addPorts([]);
                }
            } catch (err) {
                addPorts([]);
            }
            // Manual entry fallback: allow typing via prompt-style option
            $port.append($('<option/>', { value: 'COMx', text: 'Type manually (COMx)...' }));
        }

        function currentHexPath() {
            var fam = MAKE_INTERFACES.firmwares[$family.val()];
            if (!fam) {
                return $hex.val() || '';
            }
            return fam.dir + '/' + ($hex.val() || '');
        }

        function refreshCommand() {
            $cmd.val(makeInterfacesAvrdudeCommand(currentHexPath(), $port.val() || 'COMx', $board.val(), parseInt($baud.val(), 10)));
        }

        function refreshSilabs() {
            $silabs.empty();
            MAKE_INTERFACES.silabsInterfaces.forEach(function (iface) {
                $silabs.append($('<option/>', { value: iface.id, text: iface.name }));
            });
            refreshSilabsDetail();
        }

        function refreshSilabsDetail() {
            var id = $silabs.val();
            var found = null;
            MAKE_INTERFACES.silabsInterfaces.forEach(function (iface) {
                if (iface.id === id) {
                    found = iface;
                }
            });
            if (!found) {
                $('#mi-silabs-detail').empty();
                return;
            }
            var html = '<p><strong>ESC signals:</strong> ' + found.escSignals + '</p>' +
                '<p><strong>Use for:</strong> ' + found.useFor + '</p>' +
                '<p><strong>Baud:</strong> ' + (found.baud || '-') + '</p>';
            if (found.docs && found.docs.length) {
                html += '<p><strong>Docs:</strong> ' + found.docs.join(', ') + '</p>';
            }
            $('#mi-silabs-detail').html(html);
        }

        function refreshPinoutDocsShot() {
            var $tbody = $('#mi-pinout-table tbody');
            $tbody.empty();
            MAKE_INTERFACES.pinoutNotes.forEach(function (row) {
                $tbody.append('<tr><td><code>' + row.variant + '</code></td><td>' + row.meaning + '</td></tr>');
            });
            var $docs = $('#mi-docs');
            $docs.empty();
            MAKE_INTERFACES.docsFiles.forEach(function (f) {
                $docs.append('<li><code>' + MAKE_INTERFACES.docsDir + '/' + f + '</code></li>');
            });
        }

        $family.on('change', refreshFamily);
        $board.on('change', refreshFamily);
        $hex.on('change', refreshCommand);
        $port.on('change', refreshCommand);
        $baud.on('change', refreshCommand);
        $silabs.on('change', refreshSilabsDetail);

        $('#mi-copy-cmd').on('click', function (e) {
            e.preventDefault();
            refreshCommand();
            $cmd.select();
            try {
                document.execCommand('copy');
                log('command copied to clipboard');
            } catch (err) {
                log('copy failed — select the text manually');
            }
        });

        $('#mi-save-bat').on('click', function (e) {
            e.preventDefault();
            refreshCommand();
            var content = '@echo off\r\ncd /d "%~dp0"\r\n' + $cmd.val() + '\r\n@pause\r\n';
            try {
                var blob = new Blob([content], { type: 'text/plain' });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'make_' + ($hex.val() || 'interface').replace(/\.hex$/i, '') + '.bat';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                log('.bat saved — run it from ' + MAKE_INTERFACES.avrdudeDir + '/');
            } catch (err) {
                log('save failed: ' + err.message);
            }
        });

        $('#mi-flash').on('click', function (e) {
            e.preventDefault();
            refreshCommand();
            var board = makeInterfacesFindBoard($board.val());
            var port = $port.val();
            if (!port || port === 'COMx') {
                log('pick a COM port first');
                return;
            }
            if (GUI.connected_to || GUI.connecting_to) {
                log('Disconnect the configurator first (button up top), then Flash again');
                return;
            }
            var hexFile = currentHexPath();
            var args = ['-C', 'avrdude.conf', '-p', board.mcu, '-c', board.programmer,
                '-P', (port.indexOf('COM') === 0 ? '\\\\.\\' + port : port),
                '-b', String(parseInt($baud.val(), 10) || board.baud),
                '-D', '-u', '-U', 'flash:w:"' + hexFile + '":i'];
            log('flashing ' + hexFile + ' -> ' + port + ' ...');
            var proc = miSpawnAvrdude(args, MAKE_INTERFACES.avrdudeDir, function (chunk) {
                $log.append(document.createTextNode(chunk));
            }, function (code) {
                if (code === 0) {
                    log('Flash OK (exit 0). Arduino is now a ' + $('#mi-family option:selected').text() + '.');
                } else if (code === -1) {
                    log('Direct spawn unavailable here — use Copy cmd / Save .bat and run from ' + MAKE_INTERFACES.avrdudeDir + '/');
                } else {
                    log('avrdude exit ' + code + ' — check wiring, COM port and board selection');
                }
            });
            if (!proc) {
                log('Direct spawn unavailable here — use Copy cmd / Save .bat and run from ' + MAKE_INTERFACES.avrdudeDir + '/');
            }
        });

        // Init order matters: boards -> family/hex -> ports -> rest
        var preselectPort = null;
        try {
            var cur = $('div#port-picker #port').val();
            if (cur && cur !== '0' && cur !== 'manual' && cur !== 'DFU') {
                preselectPort = cur;
            }
        } catch (err) { /* keep null */ }

        refreshBoards();
        refreshFamily();
        refreshPorts(preselectPort);
        refreshSilabs();
        refreshPinoutDocsShot();
        refreshCommand();

        GUI.content_ready(callback);
    });
};

TABS.make_interfaces.cleanup = function (callback) {
    if (callback) {
        callback();
    }
};
