export function getActionDefinitions(self) {
    const actions = {};

    actions['stop_all'] = {
        name: 'Stop All Audio',
        options: [],
        callback: async (action) => {
            if (self.ws && self.ws.readyState === WebSocket.OPEN) {
                self.ws.send(JSON.stringify({ 
                    action: 'stopAllCues',
                    payload: {
                        behavior: 'fade_out_and_stop'
                    }
                }));
            }
        },
    };

    if (self.cues && self.cues.length > 0) {
        self.cues.forEach(cue => {
            actions[`play_cue_${cue.id}`] = {
                name: `Play: ${cue.name || cue.id}`,
                options: [],
                callback: async (action) => {
                    if (self.ws && self.ws.readyState === WebSocket.OPEN) {
                        self.ws.send(JSON.stringify({ action: 'playCue', payload: { cueId: cue.id } }));
                    }
                },
            };
            actions[`stop_cue_${cue.id}`] = {
                name: `Stop: ${cue.name || cue.id}`,
                options: [],
                callback: async (action) => {
                    if (self.ws && self.ws.readyState === WebSocket.OPEN) {
                        self.ws.send(JSON.stringify({ action: 'stopCue', payload: { cueId: cue.id } }));
                    }
                },
            };
            actions[`toggle_cue_${cue.id}`] = {
                name: `Toggle: ${cue.name || cue.id}`,
                options: [],
                callback: async (action) => {
                    if (self.ws && self.ws.readyState === WebSocket.OPEN) {
                        self.ws.send(JSON.stringify({ action: 'toggleCue', payload: { cueId: cue.id } }));
                    }
                },
            };
        });
    }
    return actions;
} 