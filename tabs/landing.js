'use strict';

TABS.landing = {};
TABS.landing.initialize = function (callback) {
    var self = this;

    if (GUI.active_tab != 'landing') {
        GUI.active_tab = 'landing';
        googleAnalytics.sendAppView('Landing');
    }

    $('#content').load("./tabs/landing.html", function () {
        // translate to user-selected language
        localize();

        // Open links in external browser
        $('a[target=_blank]').click(function () {
            nw.Shell.openExternal(this.href);
            return false;
        });

        $('div.welcome a, div.sponsors a').click(function () {
            googleAnalytics.sendEvent('ExternalUrls', 'Click', $(this).prop('href'));
        });

        GUI.content_ready(callback);
    });

};

TABS.landing.cleanup = function (callback) {
    if (callback) callback();
};
