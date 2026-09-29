'use strict';

const METAINFO_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const OPEN_ESC_RESET_DELAY_MS = 1000;

// Fix for nw.js which has regeneratorRuntime defined in global.
if (window.regeneratorRuntime == undefined) {
    window.regeneratorRuntime = global.regeneratorRuntime;
}

var Configurator = React.createClass({
    getInitialState: () => {
        return {
            canRead: true,
            canWrite: false,

            escSettings: [],
            escMetainfo: [],

            currentSettingsInstanceId: 0
        };
    },
    componentWillMount: function() {
        this.updateVersionsMetainfo();
        const interval = setInterval(this.updateVersionsMetainfo, METAINFO_UPDATE_INTERVAL_MS);

        this.setState({
            updateInterval: interval
        });
    },
    componentWillUnmount: function() {
        if (this.state.updateInterval) {
            clearInterval(this.state.updateInterval);
        }
    },
    updateVersionsMetainfo: function() {
        fetchJSON(BLHELI_ESCS_KEY, BLHELI_ESCS_REMOTE, BLHELI_ESCS_LOCAL)
        .then(json => {
            json.layouts[BLHELI_TYPES.BLHELI_S_SILABS] = {}
            this.setState({ supportedBlheliESCs: json })
        });

        fetchJSON(BLUEJAY_ESCS_KEY, BLUEJAY_ESCS_REMOTE, BLUEJAY_ESCS_LOCAL)
        .then(json => this.setState({ supportedBluejayESCs: json }));

        fetchJSON(OPEN_ESC_ESCS_KEY, OPEN_ESC_ESCS_REMOTE, OPEN_ESC_ESCS_LOCAL)
        .then(json => this.setState({ supportedOpenEscESCs: json }));
    },
    onUserInput: function(newSettings) {
        this.setState({
            escSettings: newSettings
        });
    },
    saveLog: () => saveFile(console.dump().join('\n')),
    readSetup: async function() {
        GUI.log(chrome.i18n.getMessage('readSetupStarted'));
        $('a.connect').addClass('disabled');

        // disallow further requests until we're finished
        // @todo also disable settings alteration
        this.setState({
            canRead: false,
            canWrite: false
        });

        try {
            await this.readSetupAll();
            GUI.log(chrome.i18n.getMessage('readSetupFinished'));
        } catch (error) {
            GUI.log(chrome.i18n.getMessage('readSetupFailed', [ error.stack ]));
        }

        const availableMetainfo = this.state.escMetainfo.filter(metainfo => metainfo.available);
        if (!availableMetainfo.every(metainfo => metainfo.interfaceMode === availableMetainfo[0].interfaceMode)) {
            throw new Error('Mixing of different ESC types not supported.');
        }
        const isOpenEsc = availableMetainfo[0] && availableMetainfo[0].interfaceMode === _4way_modes.ARMBLB;

        const availableSettings = this.state.escSettings.filter((i, idx) => this.state.escMetainfo[idx].available);

        const isBluejay = !isOpenEsc && availableSettings.every(settings => BLUEJAY_SETTINGS_DESCRIPTIONS[settings.LAYOUT_REVISION] != null);

        // Enable writes if any ESC answered with settings
        const canResetDefaults = isOpenEsc || isBluejay || availableSettings.every(settings => settings.LAYOUT_REVISION > BLHELI_S_MIN_LAYOUT_REVISION);
        const canPlayMusic = isBluejay
                             && availableSettings.length > 0
                             && availableSettings.map(s => BLUEJAY_INDIVIDUAL_SETTINGS_DESCRIPTIONS[s.LAYOUT_REVISION]).every(x => x['base'].find(x => x.name === 'STARTUP_MELODY'))
                             && availableSettings.every(settings => settings.STARTUP_MELODY.length > 0);

        this.setState({
            canRead: true,
            canWrite: availableSettings.length > 0,
            canResetDefaults: canResetDefaults,
            isMelodyEditorShown: this.state.isMelodyEditorShown || false,
            canPlayMusic: canPlayMusic,
            isPlayingMusic: false,
            doPlayMusic: false,
            doStopMusic: false,
            musicPlaybackStatus: (new Array(this.state.escSettings.length)).fill(false),
            currentSettingsInstanceId: this.state.currentSettingsInstanceId + 1
        });

        $('a.connect').removeClass('disabled');
    },
    readSetupAll: async function() {
        var escSettings = [],
            escMetainfo = [];

        if (Debug.enabled) {
            escSettings = [ Debug.getDummySettings(BLHELI_TYPES.BLHELI_S_SILABS) ];
            escMetainfo = [ Debug.getDummyMetainfo(BLHELI_TYPES.BLHELI_S_SILABS) ];

            this.setState({
                escSettings: escSettings,
                escMetainfo: escMetainfo
            });

            return;
        }

        for (let esc = 0; esc < this.props.escCount; ++esc) {
            escSettings.push({});
            escMetainfo.push({});

            try {
                // Ask 4way interface to initialize target ESC
                const message = await _4way.initFlash(esc);

                // Check interface mode and read settings
                const interfaceMode = message.params[3]

                // remember interface mode for ESC
                escMetainfo[esc].interfaceMode = interfaceMode
                // @todo C2 will require redesign here
                escMetainfo[esc].signature = (message.params[1] << 8) | message.params[0];

                // read everything in one big chunk
                // SiLabs has no separate EEPROM, but Atmel has and therefore requires a different read command
                var isSiLabs = [ _4way_modes.SiLC2, _4way_modes.SiLBLB ].includes(interfaceMode),
                    isArm = interfaceMode === _4way_modes.ARMBLB,
                    settingsArray = null,
                    layout = BLHELI_LAYOUT;

                if (isSiLabs) {
                    settingsArray = (await _4way.read(BLHELI_SILABS_EEPROM_OFFSET, BLHELI_LAYOUT_SIZE)).params;
                } else if (isArm) {
                    settingsArray = (await _4way.read(OPEN_ESC_EEPROM_OFFSET, OPEN_ESC_LAYOUT_SIZE)).params;
                    layout = OPEN_ESC_LAYOUT;
                } else {
                    settingsArray = (await _4way.readEEprom(0, BLHELI_LAYOUT_SIZE)).params;
                }

                const settings = blheliSettingsObject(settingsArray, layout);

                escSettings[esc] = settings;
                escMetainfo[esc].available = true;

                googleAnalytics.sendEvent('ESC', 'VERSION', settings.MAIN_REVISION + '.' + settings.SUB_REVISION);
                googleAnalytics.sendEvent('ESC', 'LAYOUT', settings.LAYOUT ? settings.LAYOUT.replace(/#/g, '') : `Arm_${settings.LAYOUT_REVISION}`);
                // googleAnalytics.sendEvent('ESC', 'MODE', settings.MODE ? blheliModeToString(settings.MODE) : null);
                googleAnalytics.sendEvent('ESC', 'COMMUTATION_TIMING', settings.COMMUTATION_TIMING);
                googleAnalytics.sendEvent('ESC', 'DEMAG_COMPENSATION', settings.DEMAG_COMPENSATION);
                googleAnalytics.sendEvent('ESC', 'STARTUP_POWER_MIN', settings.STARTUP_POWER_MIN);
                googleAnalytics.sendEvent('ESC', 'STARTUP_POWER_MAX', settings.STARTUP_POWER_MAX);
                googleAnalytics.sendEvent('ESC', 'PWM_FREQUENCY', settings.PWM_FREQUENCY);
                googleAnalytics.sendEvent('ESC', 'DITHERING', settings.DITHERING);
                googleAnalytics.sendEvent('ESC', 'RPM_POWER_SLOPE', settings.RPM_POWER_SLOPE);
                googleAnalytics.sendEvent('ESC', 'BEACON_STRENGTH', settings.BEACON_STRENGTH);
                googleAnalytics.sendEvent('ESC', 'BEACON_DELAY', settings.BEACON_DELAY);
                googleAnalytics.sendEvent('ESC', 'TEMPERATURE_PROTECTION', settings.TEMPERATURE_PROTECTION);
                googleAnalytics.sendEvent('ESC', 'BRAKE_ON_STOP', settings.BRAKE_ON_STOP);
                // googleAnalytics.sendEvent('ESC', 'PPM_MIN_THROTTLE', settings.PPM_MIN_THROTTLE);
                // googleAnalytics.sendEvent('ESC', 'PPM_MAX_THROTTLE', settings.PPM_MAX_THROTTLE);

                if (isSiLabs) {
                    await _4way.reset(esc);
                }
            } catch (error) {
                console.log('ESC', esc + 1, 'read settings failed', error.message, error);
                escMetainfo[esc].available = false;
            }
        }

        // Update backend and trigger representation
        this.setState({
            escSettings: escSettings,
            escMetainfo: escMetainfo
        });
    },
    // @todo add validation of each setting via BLHELI_SETTINGS_DESCRIPTION
    writeSetupAll: async function() {
        for (var esc = 0; esc < this.state.escSettings.length; ++esc) {
            await this.writeSetupImpl(esc);
        }
    },
    writeSetupImpl: async function(esc) {
        try {
            if (!this.state.escMetainfo[esc].available) {
               return;
            }

            // Ask 4way interface to initialize target ESC
            const message = await _4way.initFlash(esc);
            // Remember interface mode and read settings
            var interfaceMode = message.params[3]

            // read everything in one big chunk to check if any settings have changed
            // SiLabs has no separate EEPROM, but Atmel has and therefore requires a different read command
            var isSiLabs = [ _4way_modes.SiLC2, _4way_modes.SiLBLB ].includes(interfaceMode),
                isArm = interfaceMode === _4way_modes.ARMBLB,
                readbackSettings = null,
                layout = BLHELI_LAYOUT,
                layoutSize = BLHELI_LAYOUT_SIZE;

            if (isSiLabs) {
                readbackSettings = (await _4way.read(BLHELI_SILABS_EEPROM_OFFSET, BLHELI_LAYOUT_SIZE)).params;
            } else if (isArm) {
                readbackSettings = (await _4way.read(OPEN_ESC_EEPROM_OFFSET, OPEN_ESC_LAYOUT_SIZE)).params;
                layout = OPEN_ESC_LAYOUT;
                layoutSize = OPEN_ESC_LAYOUT_SIZE;
            } else {
                readbackSettings = (await _4way.readEEprom(0, BLHELI_LAYOUT_SIZE)).params;
            }

            // Check for changes and perform write
            var escSettings = blheliSettingsArray(this.state.escSettings[esc], layout, layoutSize);

            // check for unexpected size mismatch
            if (escSettings.byteLength != readbackSettings.byteLength) {
                throw new Error('byteLength of buffers do not match')
            }

            // check for actual changes, maybe we should not write to this ESC at all
            if (compare(escSettings, readbackSettings)) {
                GUI.log(chrome.i18n.getMessage('writeSetupNoChanges', [ esc + 1 ]));
                return;
            }

            // should erase page to 0xFF on SiLabs before writing
            if (isSiLabs) {
                await _4way.pageErase(BLHELI_SILABS_EEPROM_OFFSET / BLHELI_SILABS_PAGE_SIZE);
                // actual write
                await _4way.write(BLHELI_SILABS_EEPROM_OFFSET, escSettings);
                GUI.log(chrome.i18n.getMessage('writeSetupBytesWritten', [ esc + 1, escSettings.byteLength ]));
            } else if (isArm) {
                // actual write
                await _4way.write(OPEN_ESC_EEPROM_OFFSET, escSettings);
                GUI.log(chrome.i18n.getMessage('writeSetupBytesWritten', [ esc + 1, escSettings.byteLength ]));
            } else {
                // write only changed bytes for Atmel
                for (var pos = 0; pos < escSettings.byteLength; ++pos) {
                    var offset = pos

                    // find the longest span of modified bytes
                    while (escSettings[pos] != readbackSettings[pos]) {
                        ++pos
                    }

                    // byte unchanged, continue
                    if (offset == pos) {
                        continue
                    }

                    // write span
                    await _4way.writeEEprom(offset, escSettings.subarray(offset, pos));
                    GUI.log(chrome.i18n.getMessage('writeSetupBytesWritten', [ esc + 1, pos - offset ]));
                }
            }

            if (isSiLabs) {
                readbackSettings = (await _4way.read(BLHELI_SILABS_EEPROM_OFFSET, BLHELI_LAYOUT_SIZE)).params;
            } else if (isArm) {
                readbackSettings = (await _4way.read(OPEN_ESC_EEPROM_OFFSET, OPEN_ESC_LAYOUT_SIZE)).params;
            } else {
                readbackSettings = (await _4way.readEEprom(0, BLHELI_LAYOUT_SIZE)).params;
            }

            if (!compare(escSettings, readbackSettings)) {
                throw new Error('Failed to verify settings')
            }

            if (isSiLabs) {
                await _4way.reset(esc);
            } else if (isArm) {
                await _4way.reset(esc).delay(OPEN_ESC_RESET_DELAY_MS);
            }
        } catch (error) {
            GUI.log(chrome.i18n.getMessage('writeSetupFailedOne', [ esc + 1, error.message ]));
            console.log('Error while writing settings:', error);
        }
    },
    writeSetup: async function() {
        GUI.log(chrome.i18n.getMessage('writeSetupStarted'));
        $('a.connect').addClass('disabled');

        // disallow further requests until we're finished
        // @todo also disable settings alteration
        this.setState({
            canRead: false,
            canWrite: false
        });

        try {
            await this.writeSetupAll();
            GUI.log(chrome.i18n.getMessage('writeSetupFinished'));
        } catch (error) {
            GUI.log(chrome.i18n.getMessage('writeSetupFailed', [ error.stack ]));
        }

        await this.readSetup();

        $('a.connect').removeClass('disabled');
    },
    resetDefaults: function() {
        var newSettings = [];

        this.state.escSettings.forEach((settings, index) => {
            const metainfo = this.state.escMetainfo[index];
            if (!metainfo.available) {
                newSettings.push({})
                return;
            }

            const defaults = metainfo.interfaceMode === _4way_modes.ARMBLB ? OPEN_ESC_DEFAULTS[settings.LAYOUT_REVISION] : BLUEJAY_DEFAULTS[settings.LAYOUT_REVISION];
            if (defaults) {
                for (var settingName in defaults) {
                    if (defaults.hasOwnProperty(settingName)) {
                        settings[settingName] = defaults[settingName];
                    }
                }
            }

            newSettings.push(settings);
        })

        this.setState({
            escSettings: newSettings
        });

        this.writeSetup()
        .catch(error => console.log("Unexpected error while writing default setup", error))
    },
    render: function() {
        if (!this.state.supportedBlheliESCs || !this.state.supportedBluejayESCs || !this.state.supportedOpenEscESCs) return null;

        return (
            <div className="tab-esc toolbar_fixed_bottom">
                <div className="content_wrapper">
                    <div className="note">
                        <div className="note_spacer">
                            <p dangerouslySetInnerHTML={{ __html: chrome.i18n.getMessage('escFeaturesHelp') }} />
                        </div>
                    </div>
                    {this.renderContent()}
                </div>
                <div className="content_toolbar">
                    <div className="btn log_btn">
                        <a
                            href="#"
                            onClick={this.saveLog}
                        >
                            {chrome.i18n.getMessage('escButtonSaveLog')}
                        </a>
                    </div>
                    <div className={this.state.canPlayMusic ? "showMelodyEditorCheckbox" : "hidden"}>
                        <label className="showMelodyEditorCheckboxContents">
                            <input
                                type="checkbox"
                                name="showMelodyEditor"
                                checked={this.state.isMelodyEditorShown}
                                onChange={this.toggleShowMelodyEditor}
                            />
                            <span>{chrome.i18n.getMessage("showMelodyEditor")}</span>
                        </label>
                    </div>
                    <div className="btn">
                        <a
                            href="#"
                            className={this.state.canRead ? "" : "disabled"}
                            onClick={this.readSetup}
                        >
                            {chrome.i18n.getMessage('escButtonRead')}
                        </a>
                    </div>
                    <div className="btn">
                        <a
                            href="#"
                            className={this.state.canWrite ? "" : "disabled"}
                            onClick={this.writeSetup}
                        >
                            {chrome.i18n.getMessage('escButtonWrite')}
                        </a>
                    </div>
                                        <div className={this.state.canResetDefaults ? "btn" : "hidden"}>
                        <a
                            href="#"
                            className={this.state.canWrite ? "" : "disabled"}
                            onClick={this.resetDefaults}
                        >
                            {chrome.i18n.getMessage('resetDefaults')}
                        </a>
                    </div>
                    <div className={this.state.isMelodyEditorShown ? "btn" : "hidden"}>
                        <a
                            href="#"
                            className={this.state.canWrite ? "" : "disabled"}
                            onClick={this.togglePlayStartupMusic}
                        >
                            {chrome.i18n.getMessage(this.state.isPlayingMusic ? "stopStartupMusic": "playStartupMusic")}
                        </a>
                    </div>
                </div>
            </div>
        );
    },
    toggleShowMelodyEditor: function() {
        this.setState({ isMelodyEditorShown: !this.state.isMelodyEditorShown });
    },
    togglePlayStartupMusic: function() {
        if (this.state.isPlayingMusic) {
            this.setState({
                doStopMusic: true,
                doPlayMusic: false

            });
        } else {
            this.setState({
                doPlayMusic: true,
                doStopMusic: false
            });
        }
    },
    renderContent: function() {
        const noneAvailable = !this.state.escMetainfo.some(info => info.available);
        if (noneAvailable) {
            return null;
        }

        return (
            <div>
                {this.renderWrappers()}
            </div>
        );
    },
    renderWrappers: function() {
        return (
            <div>
                <div className="leftWrapper common-config">
                    {this.renderCommonSettings()}
                </div>
                <div className="rightWrapper individual-config">
                    {this.renderIndividualSettings()}
                </div>
            </div>
        );
    },
    renderCommonSettings: function() {
        return (
            <CommonSettings
                escSettings={this.state.escSettings}
                escMetainfo={this.state.escMetainfo}
                supportedBlheliESCs={this.state.supportedBlheliESCs}
                supportedOpenEscESCs={this.state.supportedOpenEscESCs}
                supportedBluejayESCs={this.state.supportedBluejayESCs}
                currentSettingsInstanceId={this.state.currentSettingsInstanceId}
                onUserInput={this.onUserInput}
            />
        );
    },
    renderIndividualSettings: function() {
        return this.state.escMetainfo.map((info, idx) => {
            if (!info.available) {
                return null;
            }

            return (
                <IndividualSettings
                    escIndex={idx}
                    escSettings={this.state.escSettings}
                    escMetainfo={this.state.escMetainfo}
                    supportedBlheliESCs={this.state.supportedBlheliESCs}
                    supportedBluejayESCs={this.state.supportedBluejayESCs}
                    supportedOpenEscESCs={this.state.supportedOpenEscESCs}
                    onUserInput={this.onUserInput}
                    isMelodyEditorShown={this.state.isMelodyEditorShown}
                    doPlayMusic={this.state.doPlayMusic}
                    doStopMusic={this.state.doStopMusic}
                    currentSettingsInstanceId={this.state.currentSettingsInstanceId}
                    onMusicPlaybackStateChanged={this.onMusicPlaybackStateChanged}
                    GUI={GUI}
                />
            );
        });
    },
    onMusicPlaybackStateChanged: function(escIndex, isPlaying) {
        let musicPlaybackStatus = this.state.musicPlaybackStatus;
        musicPlaybackStatus[escIndex] = isPlaying;
        let isPlayingMusic = musicPlaybackStatus.some((a) => a)
        let newState = {
            musicPlaybackStatus: musicPlaybackStatus,
            isPlayingMusic: isPlayingMusic
        }

        if (!isPlayingMusic) {
            newState.doPlayMusic = false
            newState.doStopMusic = false
        }

        this.setState(newState)
    },
});
