'use strict';

function compare(lhs_array, rhs_array) {
    if (lhs_array.byteLength != rhs_array.byteLength) {
        return false;
    }

    for (var i = 0; i < lhs_array.byteLength; ++i) {
        if (lhs_array[i] !== rhs_array[i]) {
            return false;
        }
    }

    return true;
}

function ascii2buf(str) {
    var view = new Uint8Array(str.length);

    for (var i = 0; i < str.length; ++i) {
        view[i] = str.charCodeAt(i);
    }

    return view;
}

function buf2ascii(buf) {
    return String.fromCharCode.apply(null, buf);
}

function saveFile(str) {
    // Save file dialog
    chrome.fileSystem.chooseEntry({
        type: 'saveFile',
        suggestedName: 'Log',
        accepts: [{ extensions: ['txt'] }]
    }, function (fileEntry) {
        if (chrome.runtime.lastError) {
            return;
        }

        fileEntry.createWriter(function (writer) {
            writer.onwriteend = function () {
                if (writer.length === 0) {
                    writer.write(new Blob([str], { type: 'text/plain' }));
                } else {
                    GUI.log('Log file written');
                }
            };

            writer.truncate(0);
        });
    });
}

// @todo add Local Storage quota management?
function getFromCache(key, url) {
    // Look into Local Storage first
    return getFromLocalStorage(key).catch(function (error) {
        var deferred = Q.defer();

        // File is not present in Local Storage, try GET it
        $.get(url, function (content) {
            // Cache file for further use
            setToLocalStorage(key, content).then(function () {
                return deferred.resolve(content);
            }).done();
        }).fail(function () {
            return deferred.reject(new Error('File is unavailable'));
        });

        return deferred.promise;
    });
}

function getFromLocalStorage(key) {
    var deferred = Q.defer();

    chrome.storage.local.get(key, function (result) {
        var content = result[key];
        if (content) {
            deferred.resolve(content);
        } else {
            deferred.reject(new Error('Not found'));
        }
    });

    return deferred.promise;
}

function setToLocalStorage(key, content) {
    var deferred = Q.defer();

    var cacheEntry = {};
    cacheEntry[key] = content;
    chrome.storage.local.set(cacheEntry, function () {
        return deferred.resolve();
    });

    return deferred.promise;
}
