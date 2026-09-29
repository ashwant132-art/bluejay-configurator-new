'use strict';

TABS.select_interface = {};

TABS.select_interface.SUITE_BAUDS = [115200, 57600, 19200, 9600];

TABS.select_interface.initialize = function (callback) {
    var self = this;

    if (GUI.active_tab !== 'select_interface') {
        GUI.active_tab = 'select_interface';
        if (typeof googleAnalytics !== 'undefined') {
            googleAnalytics.sendAppView('SelectInterface');
        }
    }

    $('#content').load('./tabs/select_interface.html', function () {
        localize();

        var $iface = $('#si-iface');
        var $port = $('#si-port');
        var $baud = $('#si-baud');
        var $status = $('#si-status');

        function status(msg) {
            $status.html(msg);
        }

        function refreshInterfaces(preselectId) {
            $iface.empty();
            MAKE_INTERFACES.silabsInterfaces.forEach(function (iface) {
                $iface.append($('<option/>', { value: iface.id, text: iface.suiteLabel || iface.name }));
            });
            if (preselectId) {
                $iface.val(preselectId);
            }
            refreshDetail();
        }

        function refreshDetail() {
            var found = null;
            MAKE_INTERFACES.silabsInterfaces.forEach(function (iface) {
                if (iface.id === $iface.val()) {
                    found = iface;
                }
            });
            if (!found) {
                $('#si-detail').empty();
                $('#si-wiring').empty();
                return;
            }
            $('#si-detail').html(
                '<p><strong>ESC signals:</strong> ' + found.escSignals + '</p>' +
                '<p><strong>Use for:</strong> ' + found.useFor + '</p>' +
                '<p><strong>Baud:</strong> ' + (found.baud || '-') + '</p>' +
                ((found.docs && found.docs.length) ? '<p><strong>Docs:</strong> ' + found.docs.join(', ') + '</p>' : '')
            );
            $('#si-wiring').html(
                '<p><code>' + found.escSignals + '</code></p>' +
                '<p>' + found.useFor + '</p>'
            );
            // Preselect hinted baud when present
            var hint = parseInt(found.baud, 10);
            if (hint && TABS.select_interface.SUITE_BAUDS.indexOf(hint) !== -1) {
                $baud.val(String(hint));
            }
        }

        function refreshBauds() {
            $baud.empty();
            TABS.select_interface.SUITE_BAUDS.forEach(function (b) {
                $baud.append($('<option/>', { value: b, text: b }));
            });
            $baud.val('115200');
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
        }

        $iface.on('change', refreshDetail);

        $('#si-refresh').on('click', function (e) {
            e.preventDefault();
            refreshPorts();
            status('port list refreshed');
        });

        $('#si-use').on('click', function (e) {
            e.preventDefault();
            var sel = { id: $iface.val(), port: $port.val() || '', baud: $baud.val() || '' };
            try {
                chrome.storage.local.set({ selectedInterface: sel }, function () {
                    // Push the choice into the top port picker so Connect opens the right device.
                    try {
                        if (sel.port) {
                            var $topPort = $('div#port-picker #port');
                            if ($topPort.find('option[value="' + sel.port + '"]').length === 0) {
                                $topPort.append($('<option/>', { value: sel.port, text: sel.port }));
                            }
                            $topPort.val(sel.port);
                        }
                        if (sel.baud) {
                            $('div#port-picker #baud').val(sel.baud);
                        }
                    } catch (err) { /* picker not ready */ }
                    status('saved: <code>' + sel.id + '</code> on <code>' + (sel.port || 'no port') + '</code> @ <code>' + sel.baud + '</code>. ' +
                        (sel.id === 'fc-passthrough'
                            ? 'Connect up top to the FC as usual.'
                            : (sel.id === 'toolstick-c2'
                                ? 'Vendor-software path — top picker left alone.'
                                : 'Top picker synced — just press Connect up top.')));
                    GUI.log('SelectInterface: using <code>' + sel.id + '</code> port=<code>' + sel.port + '</code> baud=<code>' + sel.baud + '</code>');
                });
            } catch (err) {
                status('save failed: ' + err.message);
            }
        });

        // Restore previous selection, prefill top picker port when sane
        var topPort = null;
        try {
            var cur = $('div#port-picker #port').val();
            if (cur && cur !== '0' && cur !== 'manual' && cur !== 'DFU') {
                topPort = cur;
            }
        } catch (err) { /* ignore */ }

        refreshBauds();
        try {
            chrome.storage.local.get('selectedInterface', function (data) {
                var prev = data && data.selectedInterface;
                refreshInterfaces(prev && prev.id);
                refreshPorts((prev && prev.port) || topPort);
                if (prev && prev.baud) {
                    $baud.val(prev.baud);
                }
            });
        } catch (err) {
            refreshInterfaces();
            refreshPorts(topPort);
        }

        GUI.content_ready(callback);
    });
};

TABS.select_interface.cleanup = function (callback) {
    if (callback) {
        callback();
    }
};
