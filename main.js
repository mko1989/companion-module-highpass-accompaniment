const { InstanceBase, InstanceStatus, runEntrypoint, combineRgb } = require('@companion-module/base');
const WebSocket = require('ws');
const { getConfigFields } = require('./config.js'); // Import from config.js
const { getActionDefinitions } = require('./actions.js'); // Import from actions.js
const { getVariableDefinitions, updateVariablesForCue } = require('./variables.js'); // Import from variables.js

const MAX_CUES_FOR_VARIABLES = 20; // Define how many individual cues we'll create variables for

class SoundboardInstance extends InstanceBase {
    constructor(internal) {
        super(internal);
        this.ws = null;
        this.cues = []; // Store the cues received from the soundboard app
        this.reconnectInterval = null;
        this.currentlyPlayingCueId = null; // Track which cue is considered "currently playing"
        this.cuePlayStates = {}; // cueId: 'playing' | 'paused' | 'stopped'
    }

    async init(config) {
        this.config = config;
        this.updateStatus(InstanceStatus.Connecting);
        this.connectToSoundboard();
        this.initActions();
        this.initFeedbacks(); // Keep feedbacks if they are still relevant
        this.initPresets();
        this.initVariables(); // New method to define variables
    }

    async destroy() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        this.log('debug', 'destroy');
    }

    async configUpdated(config) {
        this.config = config;
        this.updateStatus(InstanceStatus.Connecting);
        if (this.ws) {
            this.ws.close(); // Close existing connection before reconnecting
        }
        this.connectToSoundboard();
        // Actions, feedbacks, presets might need to be re-evaluated if config affects them
        // For now, assuming host/port change is handled by reconnect.
    }

    getConfigFields() {
        return getConfigFields(); // Call the imported function
    }

    connectToSoundboard() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }

        if (!this.config.host || !this.config.port) {
            this.updateStatus(InstanceStatus.BadConfig, 'Host or Port not configured');
            return;
        }

        const url = `ws://${this.config.host}:${this.config.port}`;
        this.log('info', `Connecting to acCompaniment at ${url}`);

        if (this.ws) {
            this.ws.close(); // Ensure old connection is closed
        }
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            this.log('info', 'Connected to acCompaniment');
            this.updateStatus(InstanceStatus.Ok);
            if (this.reconnectInterval) {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.log('debug', `Received message: ${JSON.stringify(message)}`);

                if (message.event === 'cuesListUpdate' && message.payload && Array.isArray(message.payload.cues)) {
                    this.cues = message.payload.cues;
                    this.log('info', `Received ${this.cues.length} cues from acCompaniment.`);
                    this.initActions(); 
                    this.initPresets();
                    // this.checkFeedbacks(); // Consider if feedbacks need update based on cue list

                    // Update variable names for the first MAX_CUES_FOR_VARIABLES
                    const cueNameUpdates = {};
                    for (let i = 0; i < MAX_CUES_FOR_VARIABLES; i++) {
                        const prefix = `cue_${i + 1}`;
                        if (this.cues[i]) {
                            cueNameUpdates[`${prefix}_name`] = this.cues[i].name || `Cue ${i + 1}`;
                            // When cue list updates, reset other specific cue variables to default unless a specific update comes
                            cueNameUpdates[`${prefix}_status`] = 'stopped';
                            cueNameUpdates[`${prefix}_playlist_item_name`] = '';
                            cueNameUpdates[`${prefix}_time_formatted`] = '00:00';
                            cueNameUpdates[`${prefix}_duration_formatted`] = '00:00';
                            cueNameUpdates[`${prefix}_remaining_formatted`] = '00:00';
                            cueNameUpdates[`${prefix}_time_sec`] = 0;
                            cueNameUpdates[`${prefix}_duration_sec`] = 0;
                            cueNameUpdates[`${prefix}_remaining_sec`] = 0;
                        } else {
                            // If fewer cues than MAX_CUES_FOR_VARIABLES, set unused variable slots to N/A
                            cueNameUpdates[`${prefix}_name`] = 'N/A';
                            cueNameUpdates[`${prefix}_status`] = 'stopped';
                            cueNameUpdates[`${prefix}_playlist_item_name`] = '';
                            cueNameUpdates[`${prefix}_time_formatted`] = '00:00';
                            cueNameUpdates[`${prefix}_duration_formatted`] = '00:00';
                            cueNameUpdates[`${prefix}_remaining_formatted`] = '00:00';
                            cueNameUpdates[`${prefix}_time_sec`] = 0;
                            cueNameUpdates[`${prefix}_duration_sec`] = 0;
                            cueNameUpdates[`${prefix}_remaining_sec`] = 0;
                        }
                    }
                    if (Object.keys(cueNameUpdates).length > 0) {
                        this.setVariableValues(cueNameUpdates);
                    }
                    // It's possible the currentlyPlayingCueId is no longer valid, clear it if so
                    if (this.currentlyPlayingCueId && !this.cues.find(c => c.id === this.currentlyPlayingCueId)) {
                        this.currentlyPlayingCueId = null;
                        const currentlyPlayingPrefix = 'current_cue';
                        this.setVariableValues({
                            [`${currentlyPlayingPrefix}_name`]: 'N/A',
                            [`${currentlyPlayingPrefix}_status`]: 'stopped',
                            [`${currentlyPlayingPrefix}_playlist_item_name`]: '',
                            [`${currentlyPlayingPrefix}_time_formatted`]: '00:00',
                            [`${currentlyPlayingPrefix}_duration_formatted`]: '00:00',
                            [`${currentlyPlayingPrefix}_remaining_formatted`]: '00:00',
                            [`${currentlyPlayingPrefix}_time_sec`]: 0,
                            [`${currentlyPlayingPrefix}_duration_sec`]: 0,
                            [`${currentlyPlayingPrefix}_remaining_sec`]: 0
                        });
                    }

                } else if (message.event === 'cueStatus') {
                    // This is somewhat deprecated by playbackTimeUpdate, but feedbacks might still use it.
                    // For variable purposes, playbackTimeUpdate is more comprehensive.
                    // const cueId = message.payload.cueId;
                    // const status = message.payload.status;
                    // this.cuePlayStates[cueId] = status; // Old way
                    // this.checkFeedbacks(...); // Old way based on cue_playing_status_cueId
                
                } else if (message.type === 'playbackTimeUpdate' && message.data) {
                    updateVariablesForCue(this, message.data); // Call imported function, passing 'this'

                    // Update cuePlayStates for feedbacks
                    const { cueId, status } = message.data;
                    if (cueId && status) {
                        const oldStatus = this.cuePlayStates[cueId];
                        this.cuePlayStates[cueId] = status;

                        // If status changed, check relevant feedbacks
                        // We check all types of feedbacks since a single cueId can only be in one state
                        if (oldStatus !== status) {
                            this.checkFeedbacks('cue_is_playing', 'cue_is_paused', 'cue_is_stopped');
                        }
                    }
                }
            } catch (e) {
                this.log('error', 'Failed to parse message from acCompaniment: ' + e.toString());
            }
        });

        this.ws.on('close', (code, reason) => {
            this.log('info', `Connection closed. Code: ${code}, Reason: ${reason}`);
            this.updateStatus(InstanceStatus.Disconnected, 'Connection closed');
            this.ws = null;
            if (this.config.reconnect && !this.reconnectInterval) {
                this.reconnectInterval = setInterval(() => {
                    this.log('info', 'Attempting to reconnect...');
                    this.connectToSoundboard();
                }, 5000);
            }
        });

        this.ws.on('error', (err) => {
            this.log('error', 'WebSocket error: ' + err.message);
            this.updateStatus(InstanceStatus.ConnectionFailure, 'Connection error');
            if (this.ws && this.ws.readyState !== WebSocket.OPEN && this.ws.readyState !== WebSocket.CONNECTING) {
                if (this.config.reconnect && !this.reconnectInterval) {
                    this.reconnectInterval = setInterval(() => {
                        this.log('info', 'Attempting to reconnect after error...');
                        this.connectToSoundboard();
                    }, 5000);
                }
            }
        });
    }

    initActions() {
        this.setActionDefinitions(getActionDefinitions(this)); // Pass 'this' (self) to the function
    }

    initFeedbacks() {
        const feedbacks = {
            'cue_is_playing': {
                type: 'boolean',
                name: 'Cue is Playing',
                description: 'If the specified cue is currently playing.',
                defaultStyle: {
                    color: combineRgb(0, 0, 0), // Black text
                    bgcolor: combineRgb(0, 255, 0), // Green background
                },
                options: [
                    {
                        type: 'textinput',
                        label: 'Cue ID',
                        id: 'cueId',
                        default: '',
                        tooltip: 'Enter the ID of the cue to monitor.',
                    },
                ],
                callback: (feedback) => {
                    const cueId = feedback.options.cueId;
                    return this.cuePlayStates[cueId] === 'playing';
                },
            },
            'cue_is_paused': {
                type: 'boolean',
                name: 'Cue is Paused',
                description: 'If the specified cue is currently paused.',
                defaultStyle: {
                    color: combineRgb(0, 0, 0), // Black text
                    bgcolor: combineRgb(255, 165, 0), // Orange background
                },
                options: [
                    {
                        type: 'textinput',
                        label: 'Cue ID',
                        id: 'cueId',
                        default: '',
                    },
                ],
                callback: (feedback) => {
                    const cueId = feedback.options.cueId;
                    return this.cuePlayStates[cueId] === 'paused';
                },
            },
            'cue_is_stopped': { 
                type: 'boolean',
                name: 'Cue is Stopped / Inactive',
                description: 'If the specified cue is currently stopped or not active.',
                defaultStyle: {
                    color: combineRgb(255, 255, 255), // White text
                    bgcolor: combineRgb(0, 0, 0),     // Black background
                },
                options: [
                    {
                        type: 'textinput',
                        label: 'Cue ID',
                        id: 'cueId',
                        default: '',
                    },
                ],
                callback: (feedback) => {
                    const cueId = feedback.options.cueId;
                    const status = this.cuePlayStates[cueId];
                    return status === 'stopped' || status === 'error' || !status; 
                },
            },
        };
        this.setFeedbackDefinitions(feedbacks);
    }

    initPresets() {
        const presets = [];
        if (this.cues && this.cues.length > 0) {
            this.cues.forEach(cue => {
                presets.push({
                    type: 'button',
                    category: 'Sound Cues',
                    name: `Play ${cue.name || cue.id}`,
                    style: {
                        text: `TOGGLE\n${cue.name || cue.id}`,
                        size: 'auto',
                        color: combineRgb(255, 255, 255), // White text for stopped state
                        bgcolor: combineRgb(0, 0, 0),     // Black background for stopped state
                    },
                    steps: [
                        {
                            down: [
                                {
                                    actionId: `toggle_cue_${cue.id}`,
                                    options: {},
                                },
                            ],
                            up: [],
                        },
                    ],
                    feedbacks: [
                        {
                            feedbackId: 'cue_is_playing',
                            options: { cueId: cue.id },
                            style: { // This style is applied by default by the feedback definition
                                bgcolor: combineRgb(0,160,0)
                            }
                        },
                        {
                            feedbackId: 'cue_is_paused',
                            options: { cueId: cue.id },
                            style: { // This style is applied by default by the feedback definition
                                bgcolor: combineRgb(255,165,0)
                            }
                        },
                        // Optional: Explicit feedback for stopped state if needed, though base style handles it.
                        // {
                        //    feedbackId: 'cue_is_stopped',
                        //    options: { cueId: cue.id },
                        //    style: { }
                        // }
                    ],
                });
            });
        }

        presets.push({
            type: 'button',
            category: 'Controls',
            name: 'Stop All Audio',
            style: {
                text: 'STOP ALL',
                size: 'auto',
                color: combineRgb(255, 255, 255),
                bgcolor: combineRgb(200, 0, 0),
            },
            steps: [
                {
                    down: [
                        {
                            actionId: 'stop_all',
                            options: {},
                        },
                    ],
                    up: [],
                },
            ],
            feedbacks: [],
        });

        this.setPresetDefinitions(presets);
    }

    initVariables() {
        const { definitions, initialValues } = getVariableDefinitions(); // Get defs and initial values
        this.setVariableDefinitions(definitions);
        this.setVariableValues(initialValues);
    }
}

runEntrypoint(SoundboardInstance, []); 